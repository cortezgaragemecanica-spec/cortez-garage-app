package com.cortezgarage.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class OrderNotificationService extends Service {
    private static final String CHANNEL_MONITOR = "cortez-monitor";
    private static final String CHANNEL_ORDERS = "cortez-orders";
    private static final int FOREGROUND_ID = 4100;
    private ScheduledExecutorService executor;

    @Override public void onCreate() {
        super.onCreate();
        createChannels();
        startForeground(FOREGROUND_ID, notification(CHANNEL_MONITOR, "Cortez Garage", "Monitorando novas entradas", true));
        executor = Executors.newSingleThreadScheduledExecutor();
        executor.scheduleWithFixedDelay(this::checkOrders, 10, 120, TimeUnit.SECONDS);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_STICKY; }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() { if (executor != null) executor.shutdownNow(); super.onDestroy(); }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel monitor = new NotificationChannel(CHANNEL_MONITOR, "Monitoramento do aplicativo", NotificationManager.IMPORTANCE_LOW);
        NotificationChannel orders = new NotificationChannel(CHANNEL_ORDERS, "Novas ordens de serviço", NotificationManager.IMPORTANCE_HIGH);
        manager.createNotificationChannel(monitor); manager.createNotificationChannel(orders);
    }

    private Notification notification(String channel, String title, String text, boolean ongoing) {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, channel) : new Notification.Builder(this);
        return builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(text).setContentIntent(pending).setAutoCancel(!ongoing).setOngoing(ongoing).build();
    }

    private void checkOrders() {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection)new URL(MainActivity.SYNC_URL).openConnection();
            connection.setRequestMethod("POST"); connection.setConnectTimeout(20000); connection.setReadTimeout(30000); connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "text/plain;charset=utf-8");
            byte[] body = new JSONObject().put("action", "orderAlerts").put("token", MainActivity.SYNC_TOKEN).toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = connection.getOutputStream()) { out.write(body); }
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) return;
            StringBuilder json = new StringBuilder(); try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) { String line; while ((line = reader.readLine()) != null) json.append(line); }
            JSONObject result = new JSONObject(json.toString()); if (!result.optBoolean("ok")) return;
            JSONArray items = result.optJSONArray("orders"); if (items == null || items.length() == 0) return;
            SharedPreferences prefs = getSharedPreferences("cortez-notifications", MODE_PRIVATE); int last = prefs.getInt("lastOrder", -1), newest = last;
            List<JSONObject> newOrders = new ArrayList<>(); for (int i=0;i<items.length();i++) { JSONObject order=items.getJSONObject(i); int number=order.optInt("number"); newest=Math.max(newest,number); if(last>=0&&number>last)newOrders.add(order); }
            if(last<0){prefs.edit().putInt("lastOrder",newest).apply();return;}
            newOrders.sort(Comparator.comparingInt(item->item.optInt("number"))); NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            for(JSONObject order:newOrders){int number=order.optInt("number");String client=order.optString("client"),plate=order.optString("plate"),text=(client.isEmpty()?"Novo veículo":client)+(plate.isEmpty()?"":" · "+plate);manager.notify(5000+number,notification(CHANNEL_ORDERS,"Nova O.S. #"+String.format("%04d",number),text,false));}
            if(newest>last)prefs.edit().putInt("lastOrder",newest).apply();
        } catch (Exception ignored) {} finally { if(connection!=null)connection.disconnect(); }
    }
}

