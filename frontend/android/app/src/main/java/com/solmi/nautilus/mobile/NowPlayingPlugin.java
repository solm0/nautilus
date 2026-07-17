package com.solmi.nautilus.mobile;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NowPlaying")
public class NowPlayingPlugin extends Plugin {
    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject result = new JSObject();

        result.put("platform", "android");
        result.put("supported", false);
        result.put("granted", false);
        result.put("needs_user_action", false);

        call.resolve(result);
    }

    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void getCurrentTrack(PluginCall call) {
        call.resolve(buildEmptyTrack("android"));
    }

    @PluginMethod
    public void getNotificationPermissionStatus(PluginCall call) {
        JSObject result = new JSObject();
        boolean granted = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        boolean canRequest = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(getContext(), android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED;

        result.put("granted", granted);
        result.put("can_request", canRequest);
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private JSObject buildEmptyTrack(String source) {
        JSObject result = new JSObject();
        result.put("available", false);
        result.put("source", source);
        result.put("is_playing", false);
        result.put("progress_ms", JSObject.NULL);
        result.put("duration_ms", JSObject.NULL);
        result.put("timestamp", JSObject.NULL);
        result.put("track", JSObject.NULL);
        result.put("device", JSObject.NULL);

        JSObject sourceQuery = new JSObject();
        sourceQuery.put("primary", JSObject.NULL);
        sourceQuery.put("fallbacks", new org.json.JSONArray());
        result.put("source_query", sourceQuery);
        result.put("lyrics", JSObject.NULL);
        return result;
    }
}
