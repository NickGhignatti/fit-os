import java.io.ByteArrayOutputStream
import javax.inject.Inject
import org.gradle.process.ExecOperations

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.nickghignatti.tracker"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.nickghignatti.tracker"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

dependencies {
    implementation(project(":domain"))
    // Only needed to assemble the DI graph; UI code talks to :domain interfaces.
    implementation(project(":data"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.core)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    implementation(libs.play.services.code.scanner)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.lifecycle.viewmodel.compose)

    testImplementation(testFixtures(project(":domain")))
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.robolectric)
}

// `./gradlew runApp` boots the emulator if no device is connected, installs the
// debug build and launches it. Pick another AVD with `-Pavd=<name>`.
val exeSuffix = if (System.getProperty("os.name").startsWith("Windows")) ".exe" else ""

val startEmulator = tasks.register<StartEmulatorTask>("startEmulator") {
    group = "run"
    description = "Starts the emulator unless a device is already connected, then waits for boot."
    adb = androidComponents.sdkComponents.adb
    emulator = androidComponents.sdkComponents.sdkDirectory.map { it.file("emulator/emulator$exeSuffix") }
    avd = providers.gradleProperty("avd").orElse("tracker")
    logFile = layout.buildDirectory.file("emulator.log")
}

tasks.named { it == "installDebug" }.configureEach { mustRunAfter(startEmulator) }

tasks.register<Exec>("runApp") {
    group = "run"
    description = "Starts the emulator if needed, installs the debug build and launches it."
    dependsOn(startEmulator, "installDebug")
    executable = androidComponents.sdkComponents.adb.get().asFile.path
    args("shell", "am", "start", "-n", "${android.defaultConfig.applicationId}/.MainActivity")
}

abstract class StartEmulatorTask : DefaultTask() {
    @get:Internal abstract val adb: RegularFileProperty
    @get:Internal abstract val emulator: RegularFileProperty
    @get:Input abstract val avd: Property<String>
    @get:Internal abstract val logFile: RegularFileProperty
    @get:Inject abstract val execOps: ExecOperations

    @TaskAction
    fun start() {
        val log = logFile.get().asFile
        val process = if (hasDevice()) {
            null
        } else {
            val binary = emulator.get().asFile
            if (!binary.exists()) throw GradleException("Emulator not found at $binary; install it with sdkmanager.")
            logger.lifecycle("Starting emulator '${avd.get()}' (log: $log)")
            log.parentFile.mkdirs()
            // Software rendering: WSLg has no usable host GPU for the emulator.
            ProcessBuilder(binary.path, "-avd", avd.get(), "-no-boot-anim", "-gpu", "swiftshader_indirect")
                .redirectErrorStream(true)
                .redirectOutput(log)
                .start()
                .also { it.outputStream.close() }
        }
        awaitBoot(process, log)
    }

    private fun hasDevice(): Boolean =
        adb("devices").lineSequence().drop(1).any { it.endsWith("\tdevice") }

    private fun awaitBoot(process: Process?, log: File) {
        val deadline = System.nanoTime() + BOOT_TIMEOUT_SECONDS * 1_000_000_000L
        while (adb("shell", "getprop", "sys.boot_completed") != "1") {
            if (process != null && !process.isAlive) throw GradleException("Emulator exited early; see $log")
            if (System.nanoTime() > deadline) throw GradleException("Device did not boot within ${BOOT_TIMEOUT_SECONDS}s")
            Thread.sleep(2_000)
        }
    }

    private fun adb(vararg args: String): String {
        val out = ByteArrayOutputStream()
        execOps.exec {
            commandLine(adb.get().asFile.path, *args)
            standardOutput = out
            errorOutput = ByteArrayOutputStream()
            isIgnoreExitValue = true
        }
        return out.toString().trim()
    }

    private companion object {
        const val BOOT_TIMEOUT_SECONDS = 180
    }
}
