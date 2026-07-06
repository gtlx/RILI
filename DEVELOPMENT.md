# RILI 开发手册

## 环境要求

- Rust (nightly)
- Node.js 18+
- pnpm
- Android SDK + NDK (API 35, NDK 27+)
- JDK 21
- cargo-tauri CLI v2

## 路径中文绕坑方案

**项目路径包含中文字符 `(示例)`，导致 Java/Gradle/apksigner 报 `InvalidPathException`。**

所有涉及 Java/Gradle 的步骤必须在**纯 ASCII 路径**下执行。

### 方案 A：使用临时路径构建 APK（推荐）

```bash
# 1. 构建前端
npm --prefix frontend run build

# 2. 编译 Rust（Android arm64）
cargo build --target aarch64-linux-android --release -p rili-tauri

# 3. 复制 Android 项目到纯 ASCII 路径
rm -rf /tmp/android-build
cp -rL rili-tauri/gen/android /tmp/android-build

# 4. 复制前端资源到 assets
cp -r frontend/dist/* /tmp/android-build/app/src/main/assets/

# 5. 复制 Rust .so 到 jniLibs
cp target/aarch64-linux-android/release/librili_tauri_lib.so \
   /tmp/android-build/app/src/main/jniLibs/arm64-v8a/

# 6. 构建 APK
cd /tmp/android-build
ANDROID_HOME=/path/to/android-sdk \
ANDROID_NDK_HOME=$ANDROID_HOME/ndk/27.3.13750724 \
JAVA_TOOL_OPTIONS="-Dorg.gradle.vfs.watch=false -Dfile.encoding=UTF-8" \
./gradlew assembleArm64Debug --no-daemon

# APK 路径：/tmp/android-build/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk
```

### 方案 B：建立纯 ASCII symlink

```bash
ln -sf /path/to/项目 /home/gtlx/rili
# 然后所有操作通过 /home/gtlx/rili 路径执行
```

### Gradle 版本

项目使用 Gradle 8.13。分发包已预下载到 `/home/gtlx/gradle-8.13-bin.zip`。

其他项目引用方式：
```properties
# gradle-wrapper.properties
distributionUrl=file\:///home/gtlx/gradle-8.13-bin.zip
```

## Android APK 构建步骤（完整）

```bash
# 1. 确保环境变量
export ANDROID_HOME=/path/to/android-sdk
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/27.3.13750724
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk

# 2. 安装 Rust Android targets
rustup target add aarch64-linux-android armv7-linux-androideabi \
  i686-linux-android x86_64-linux-android

# 3. 构建前端
npm --prefix frontend run build

# 4. 构建 Rust
cargo build --target aarch64-linux-android --release -p rili-tauri

# 5. 拷贝到临时路径并执行 Gradle（参考方案 A）

# 6. （可选）签名
apksigner sign --ks debug.keystore --ks-pass pass:android \
  app-arm64-debug.apk
```

## 调试

### 查看 Android 日志

```bash
adb logcat | grep RustStdoutStderr
```

### 查看崩溃日志

```bash
adb logcat -b crash
```

### Rust panic 定位

panic 信息会以 `RustStdoutStderr` 标签输出到 logcat，包含文件名和行号。

## 关键依赖

| 依赖 | 版本 | 说明 |
|------|------|------|
| tauri | 2.x | 桌面/移动框架 |
| tauri-plugin-dialog | 2.x | 文件对话框 |
| tauri-plugin-fs | 2.x | 文件系统访问 |
| tauri-plugin-opener | 2.x | 打开外部链接 |
| reqwest (rustls-tls) | 0.12 | HTTP 客户端（Android 使用 rustls） |
| rusqlite | 0.32 | SQLite 数据库 |
| date-fns | 4.x | 日期处理 |
| recharts | 2.x | 图表组件 |
| zustand | 4.x | 状态管理 |
