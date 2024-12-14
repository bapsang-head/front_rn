# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ProGuard 기본 설정
-dontwarn com.facebook.react.**
-keep class com.facebook.react.** { *; }
-keep class com.facebook.** { *; }
-keepattributes *Annotation*
-keep class android.util.Log { *; }

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }


# JavaScript Interface (React Native 내부에서 사용)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Date 관련 클래스 보호
-keepclassmembers class java.util.Date { *; }
-keepclassmembers class java.text.SimpleDateFormat { *; }

# 네트워크 라이브러리 관련 규칙
-keep class com.facebook.react.modules.network.** { *; }
-keep class com.squareup.okhttp3.** { *; }

# Add any project specific keep options here:
