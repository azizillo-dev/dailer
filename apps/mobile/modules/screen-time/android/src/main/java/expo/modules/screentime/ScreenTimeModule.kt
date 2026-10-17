package expo.modules.screentime

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

/**
 * Telefon ekran vaqti (Android UsageStatsManager).
 *
 * Har kun uchun: oldingi planda (foreground) bo'lgan vaqt — ilovalar bo'yicha,
 * va qulf necha marta ochilgani (pickups). Asosiy ekran (launcher) va tizim paneli hisobga olinmaydi —
 * "Digital Wellbeing" bilan taqqoslanadigan raqam chiqadi.
 */
class ScreenTimeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("ScreenTime")

    Function("hasPermission") { hasPermission() }

    Function("openSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        // Ba'zi qurilmalar to'g'ridan-to'g'ri shu ilova sahifasini ochadi
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        context.startActivity(intent)
      } catch (e: Exception) {
        context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    // Oxirgi `days` kun (bugun ham), eskidan yangiga
    AsyncFunction("getDays") { days: Int ->
      if (!hasPermission()) throw SecurityException("Usage access is not granted")
      collect(days.coerceIn(1, 62))
    }
  }

  private fun hasPermission(): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun excludedPackages(): Set<String> {
    val pm = context.packageManager
    val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    val launchers = pm.queryIntentActivities(home, PackageManager.MATCH_DEFAULT_ONLY).map { it.activityInfo.packageName }
    return launchers.toSet() + setOf("com.android.systemui", "android")
  }

  private fun label(pkg: String, cache: MutableMap<String, String>): String =
    cache.getOrPut(pkg) {
      try {
        val pm = context.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
      } catch (e: Exception) {
        pkg.substringAfterLast('.').replaceFirstChar { it.uppercase() }
      }
    }

  private fun collect(days: Int): List<Map<String, Any>> {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val excluded = excludedPackages()
    val labels = mutableMapOf<String, String>()
    val now = System.currentTimeMillis()
    val out = mutableListOf<Map<String, Any>>()

    val cal = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
      add(Calendar.DAY_OF_YEAR, -(days - 1))
    }
    repeat(days) {
      val start = cal.timeInMillis
      val y = cal.get(Calendar.YEAR); val m = cal.get(Calendar.MONTH) + 1; val d = cal.get(Calendar.DAY_OF_MONTH)
      cal.add(Calendar.DAY_OF_YEAR, 1)
      val end = minOf(cal.timeInMillis, now)

      val perApp = mutableMapOf<String, Long>()
      // Kalit — "paket/activity": bitta ilovaning bir nechta oynasi bo'lishi mumkin
      val resumedAt = mutableMapOf<String, Long>()
      val seen = mutableSetOf<String>()
      var pickups = 0

      val events = usm.queryEvents(start, end)
      val e = UsageEvents.Event()
      while (events.hasNextEvent()) {
        events.getNextEvent(e)
        val pkg = e.packageName ?: continue
        val key = "$pkg/${e.className}"
        when (e.eventType) {
          UsageEvents.Event.ACTIVITY_RESUMED -> {
            resumedAt[key] = e.timeStamp
            seen.add(key)
          }
          UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
            val from = resumedAt.remove(key) ?: if (key !in seen) start else null
            seen.add(key)
            if (from != null && pkg !in excluded) perApp[pkg] = (perApp[pkg] ?: 0L) + (e.timeStamp - from)
          }
          else -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && e.eventType == UsageEvents.Event.KEYGUARD_HIDDEN) pickups++
        }
      }
      // Hali ochiq turgan oyna — kun oxirigacha (yoki hozirgacha)
      for ((key, from) in resumedAt) {
        val pkg = key.substringBefore('/')
        if (pkg !in excluded) perApp[pkg] = (perApp[pkg] ?: 0L) + (end - from)
      }

      val apps = perApp.entries
        .map { (pkg, ms) -> mapOf("id" to pkg, "name" to label(pkg, labels), "minutes" to (ms / 60000).toInt()) }
        .filter { (it["minutes"] as Int) >= 1 }
        .sortedByDescending { it["minutes"] as Int }
      val totalMin = (perApp.values.sum() / 60000).toInt().coerceIn(0, 24 * 60)

      out.add(
        mapOf(
          "date" to "%04d-%02d-%02d".format(y, m, d),
          "totalMin" to totalMin,
          "pickups" to pickups,
          "apps" to apps.take(12),
        )
      )
    }
    return out
  }
}
