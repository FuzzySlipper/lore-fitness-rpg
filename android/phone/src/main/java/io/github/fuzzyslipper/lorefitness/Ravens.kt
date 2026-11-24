package io.github.fuzzyslipper.lorefitness

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalTime

/**
 * Leliana's ravens: short in-character notifications when the journal records something that
 * happened, said from what the ledger actually committed. Android mirrors them to the watch.
 * During quiet hours they wait and arrive together afterwards; nothing is dropped.
 */
object Ravens {
    private const val CHANNEL = "ravens"
    private val NOTIFY_KINDS = setOf("check-in", "bonus-roll", "spend")

    fun deliver(context: Context, journal: JSONArray, summary: JSONObject?) {
        val prefs = context.getSharedPreferences("ravens", Context.MODE_PRIVATE)
        val newest = (0 until journal.length()).maxOfOrNull { journal.getJSONObject(it).optLong("seq") } ?: 0L
        val level = summary?.optJSONObject("character")?.optInt("level") ?: 0
        // The first sync after install: what is already in the journal is history, not news.
        if (!prefs.contains("lastSeq")) {
            prefs.edit().putLong("lastSeq", newest).putInt("lastLevel", level).putString("waiting", "[]").commit()
            return
        }
        val lastSeq = prefs.getLong("lastSeq", 0)
        // Waiting ravens are {text, checkInId}; a withdrawal takes back the raven for its check-in
        // when that raven has not flown yet, and is announced itself when it has.
        val stored = JSONArray(prefs.getString("waiting", "[]"))
        val waiting = (0 until stored.length()).map { i ->
            stored.optJSONObject(i) ?: JSONObject().put("text", stored.getString(i))
        }.toMutableList()
        (0 until journal.length()).map { journal.getJSONObject(it) }
            .filter { it.optLong("seq") > lastSeq }
            .sortedBy { it.optLong("seq") }
            .forEach { entry ->
                val checkIn = entry.optString("checkInId")
                when (entry.optString("kind")) {
                    in NOTIFY_KINDS -> waiting += JSONObject().put("text", line(entry)).put("checkInId", checkIn)
                    "withdrawal" -> if (!waiting.removeAll { checkIn.isNotEmpty() && it.optString("checkInId") == checkIn })
                        waiting += JSONObject().put("text", entry.optString("message"))
                }
            }
        val lastLevel = prefs.getInt("lastLevel", level)
        if (level > lastLevel) waiting += JSONObject().put("text", "Josephine has the new standard ready: you are level $level.")
        val store = Store.get(context)
        val texts = waiting.map { it.optString("text") }
        val sent = texts.isNotEmpty() && !store.inQuietHours(LocalTime.now()) && post(context, texts)
        prefs.edit().putLong("lastSeq", maxOf(lastSeq, newest)).putInt("lastLevel", level)
            .putString("waiting", if (sent) "[]" else JSONArray(waiting).toString()).commit()
    }

    private fun line(entry: JSONObject): String {
        val message = entry.optString("message")
        return when (entry.optString("kind")) {
            "bonus-roll" -> "The dice have spoken. $message"
            "spend" -> "Your orders went out from the war table. $message"
            else -> message
        }
    }

    private fun post(context: Context, texts: List<String>): Boolean {
        if (context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Ravens from Skyhold", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Rewards, lucky finds and war-table reports, as they are recorded in the fitness journal"
        })
        val open = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val builder = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setContentTitle(if (texts.size == 1) "A raven from Leliana" else "${texts.size} ravens from Leliana")
            .setContentText(texts.last())
            .setStyle(NotificationCompat.InboxStyle().also { style -> texts.takeLast(6).forEach(style::addLine) })
            .setContentIntent(open)
            .setAutoCancel(true)
        if (texts.size == 1) builder.setStyle(NotificationCompat.BigTextStyle().bigText(texts.single()))
        return runCatching { NotificationManagerCompat.from(context).notify(1, builder.build()); true }.getOrDefault(false)
    }
}
