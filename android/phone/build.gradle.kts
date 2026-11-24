import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Release signing: one key for both apps, kept outside the repository (docs/04-phone-and-watch.md).
// The properties file names storeFile, storePassword, keyAlias and keyPassword.
val signingFile = file(
    providers.gradleProperty("lfr.signingProperties").orNull
        ?: "${System.getProperty("user.home")}/.config/lore-fitness-rpg/signing/signing.properties",
)
val signing = Properties().apply { if (signingFile.exists()) signingFile.inputStream().use { load(it) } }
if (!signingFile.exists()) logger.warn("No release signing properties at $signingFile; release builds will be unsigned.")

android {
    namespace = "io.github.fuzzyslipper.lorefitness"
    compileSdk = 35
    defaultConfig {
        applicationId = providers.gradleProperty("lfr.appId").get()
        minSdk = 28
        targetSdk = 35
        versionCode = providers.gradleProperty("lfr.versionCode").get().toInt()
        versionName = providers.gradleProperty("lfr.versionName").get()
    }
    signingConfigs {
        if (signingFile.exists()) create("release") {
            storeFile = file(signing.getProperty("storeFile"))
            storePassword = signing.getProperty("storePassword")
            keyAlias = signing.getProperty("keyAlias")
            keyPassword = signing.getProperty("keyPassword")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}
dependencies {
    implementation(project(":core"))
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("androidx.health.connect:connect-client:1.1.0-alpha10")
    implementation("com.google.android.gms:play-services-wearable:18.2.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")
}
