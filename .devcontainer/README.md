# Vicario Development Container

## Overview

This devcontainer provides a **Java 21** development environment for Vicario while
targeting **Java 8 bytecode** output. Java 21 is required for full VS Code Java
extension support (JDT Language Server, debugging with breakpoints, hot code replace).

A separate **Java 17 testing container** is also provided to verify that the Java 8
bytecode runs correctly on newer JVM versions.

All containers are forced to **linux/amd64** architecture to match deployment targets.

## Prerequisites

- **Docker Desktop** (macOS/Windows) or **Colima** (macOS)
- **VS Code** with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
- **XQuartz** (macOS) — only needed if you want to run GUI components

### Apple Silicon (M1/M2/M3) Setup

The containers run as `linux/amd64` via Rosetta translation. For best performance
with Colima:

```bash
colima start --arch x86_64 --vm-type vz --vz-rosetta --cpu 4 --memory 8
```

With Docker Desktop, enable "Use Rosetta for x86_64/amd64 emulation on Apple Silicon"
in Settings > General.

## Quick Start

1. Open the vicario project folder in VS Code
2. When prompted, click **"Reopen in Container"** — or use the command palette:
   `Dev Containers: Reopen in Container`
3. Wait for the container to build and the `postCreateCommand` to finish (first time
   takes several minutes for dependency download and initial build)
4. Open a terminal and verify: `java -version` (should show Java 21) and `mvn -version`
5. Run `vicario HELP` to confirm the CLI wrapper is working

## Quick Reference

Common commands you'll use frequently inside the devcontainer:

```bash
# Build (also refreshes the CLI classpath)
mvn clean package dependency:copy-dependencies \
    -DoutputDirectory=target/dependency -DincludeScope=runtime -DskipTests

# Run (uses the `vicario` wrapper installed by postCreateCommand)
vicario HELP
vicario INP=input.img OUT=output.vic FORMAT=VICAR
vicario INP=input.vic OUT=output.xml FORMAT=PDS4

# Test
mvn test                                 # Run all tests
mvn test -Dtest=ClassName                # Run a specific test class
mvn test -Djava.awt.headless=true        # Run tests without display

# Debug (then attach VS Code debugger on port 5005)
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:5005 \
    -cp "target/classes:target/dependency/*" jpl.mipl.io.jConvertIIO [args...]

# Verify environment
java -version                            # Should show Java 21
mvn -version                             # Should show Maven 3.9.x
echo $DISPLAY                            # Should show host.docker.internal:0
xeyes                                    # Test X11 forwarding

# Maven cache / dependency troubleshooting
mvn dependency:tree                      # Show dependency tree
mvn dependency:resolve                   # Force re-resolve all deps
```

## Building Vicario

The `postCreateCommand` in `devcontainer.json` automatically runs an initial build
and copies runtime dependencies to `target/dependency/` when the container is created.
It also installs a `vicario` wrapper script to `/usr/local/bin/` so you can run
the tool without manually constructing a classpath.

From the integrated terminal inside the devcontainer:

```bash
# Full build with tests
mvn clean install

# Build without tests (faster)
mvn clean install -DskipTests

# Rebuild and refresh CLI classpath (after code changes)
mvn package dependency:copy-dependencies \
    -DoutputDirectory=target/dependency -DincludeScope=runtime -DskipTests

# Build FAT JAR (standalone executable, e.g. for the testing container)
mvn clean package -Pshade

# Build with headless mode (if tests create GUI components)
mvn clean install -Djava.awt.headless=true
```

The build produces Java 8 bytecode despite using Java 21 to compile, thanks to
the parent POM's `<source>8</source>` and `<target>8</target>` compiler settings.

### Build Artifacts

| Artifact | Location |
|----------|----------|
| JAR | `target/vicario-*.jar` |
| Runtime deps | `target/dependency/` (populated by `postCreateCommand`) |
| FAT JAR | `target/vicario-*-FAT.jar` (with `-Pshade`) |
| Scripts | `target/vicario-*-scripts.tar.gz` |
| XSL | `target/vicario-*-xsl.tar.gz` |

## Debugging

### VS Code Debugger (Recommended)

The devcontainer includes all necessary Java debug extensions. To debug:

1. Open `src/main/java/jpl/mipl/io/jConvertIIO.java` (or any class)
2. Set breakpoints by clicking in the gutter
3. Go to **Run and Debug** (Ctrl+Shift+D / Cmd+Shift+D)
4. Click **"create a launch.json file"** if one doesn't exist, and add:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "java",
            "name": "Debug jConvertIIO",
            "request": "launch",
            "mainClass": "jpl.mipl.io.jConvertIIO",
            "args": "",
            "cwd": "${workspaceFolder}"
        },
        {
            "type": "java",
            "name": "Debug JFrameJade",
            "request": "launch",
            "mainClass": "jpl.mipl.io.JFrameJade",
            "cwd": "${workspaceFolder}"
        },
        {
            "type": "java",
            "name": "Attach to Remote JVM",
            "request": "attach",
            "hostName": "localhost",
            "port": 5005
        }
    ]
}
```

5. Select a configuration and press F5 to start debugging

### Remote Debug (Port 5005)

To debug a running process, launch with JDWP:

```bash
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:5005 \
    -cp "target/classes:target/dependency/*" jpl.mipl.io.jConvertIIO [args...]
```

Then use the "Attach to Remote JVM" launch configuration.

### Hot Code Replace

The devcontainer has `java.debug.settings.hotCodeReplace` set to `auto`. When
debugging, you can edit code and save — changes to method bodies are applied
immediately without restarting.

## X11 Forwarding for GUI Components

Vicario includes Swing/AWT GUI components (`JFrameJade` image viewer, and others).
To display GUI windows from inside the container on your macOS desktop, you need
X11 forwarding via XQuartz.

### One-Time XQuartz Setup

1. Install XQuartz:
   ```bash
   brew install --cask xquartz
   ```

2. **Log out and log back in** (required after first install for `DISPLAY` to be set).

3. Open XQuartz, go to **Preferences > Security**, and enable:
   - **"Allow connections from network clients"**

4. Quit and restart XQuartz after changing the setting.

### Before Each Dev Session

Run on your **host Mac** (not inside the container):

```bash
# Allow connections from localhost (needed for Docker)
xhost +localhost
```

You also need to ensure `DISPLAY` is set on your host. Add to your `~/.zshrc`:

```bash
export DISPLAY=host.docker.internal:0
```

Then reload: `source ~/.zshrc`

### Verify X11 Works Inside the Container

Open a terminal in the devcontainer and run:

```bash
# Should display a pair of eyes that follow your cursor
xeyes
```

If `xeyes` appears on your Mac desktop, X11 forwarding is working.

### Running Vicario GUI

```bash
# Run JFrameJade image viewer
java -cp "target/classes:target/dependency/*" jpl.mipl.io.JFrameJade

# Run jConvertIIO with GUI display
vicario INP=input_file DISPLAY=true
```

### X11 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot open display" | Ensure `DISPLAY` is set: `echo $DISPLAY` should show `host.docker.internal:0` or similar. Run `xhost +localhost` on host. |
| XQuartz not responding | Quit XQuartz completely, restart it, re-run `xhost +localhost`. |
| Black/blank window | Try `export LIBGL_ALWAYS_SOFTWARE=1` inside the container. |
| Colima users | DISPLAY must be `host.docker.internal:0`. Ensure Colima forwards X11 socket. |

## Testing Container (Java 17)

A lightweight Java 17 runtime container packages your locally-built FAT JAR for
testing without pushing to Artifactory. See
[testing-container/README.md](../testing-container/README.md) for full details.

### Quick Start

```bash
# 1. Build the FAT JAR (in the devcontainer)
mvn clean package -Pshade

# 2. Build and launch the testing container (from project root)
./testing-container/run.sh
```

### Inside the Testing Container

```bash
java -version                    # Java 17
java -jar vicario.jar HELP
java -jar vicario.jar INP=input.img OUT=output.vic FORMAT=VICAR

# GUI (requires X11 — see X11 section above)
java -cp vicario.jar jpl.mipl.io.JFrameJade
```

### Without X11

```bash
./testing-container/run.sh --no-x11
```

### Mount Local Data

```bash
./testing-container/run.sh -- -v /path/to/images:/data
# Inside: java -jar vicario.jar INP=/data/input.img OUT=/data/output.vic FORMAT=VICAR
```

## Claude Code Integration

To use Claude Code inside the devcontainer:

1. Copy `.devcontainer/.env.example` to `.devcontainer/.env`
2. Set your `ANTHROPIC_AUTH_TOKEN` in the `.env` file
3. Inside the container, run: `claude`

The devcontainer is pre-configured with the JPL LLM proxy URL and certificate settings.

## Cross-Compilation Notes

### How It Works

The devcontainer uses **Java 21** (JDK) to compile, but the parent POM
(`parent-mipl:4.1.0`) configures `maven-compiler-plugin` with
`<source>8</source>` and `<target>8</target>`. This produces **Java 8 bytecode**
that runs on Java 8+ JVMs.

### API Surface Caveat

The `source/target` flags ensure correct bytecode version and syntax, but they
do **not** restrict the Java API surface. This means you could accidentally use
APIs introduced after Java 8 (e.g., `List.of()`, `String.strip()`,
`Map.copyOf()`). These would compile fine on Java 21 but fail at runtime on
Java 8.

**To catch these issues:** Use the Java 17 testing container to test your builds.
While not a perfect Java 8 runtime test, it validates forward-compatibility.

In the future, when the CI pipeline migrates off JDK 8, the `<release>8</release>`
compiler flag can be added to enforce API surface restrictions at compile time.

## Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `JAVA_HOME` | `/opt/java/openjdk` | Java 21 installation |
| `MAVEN_HOME` | `/usr/share/maven` | Maven installation |
| `DISPLAY` | `${localEnv:DISPLAY}` | X11 forwarding for GUI |

## Port Mappings

| Port | Purpose |
|------|---------|
| 5005 | Java Debug (Primary) — for attaching VS Code debugger |
| 5006 | Java Debug (Alternate) — for secondary debug sessions |

## Troubleshooting

### Maven dependency resolution failures

If Maven can't download dependencies, verify your network connectivity:

```bash
# Test Maven Central connectivity
curl -v https://repo.maven.apache.org/maven2/
```

If network issues persist, rebuild the container: `Dev Containers: Rebuild Container`.

### Slow performance on Apple Silicon

The `linux/amd64` architecture requires Rosetta translation on Apple Silicon.
To improve performance:

- **Colima**: Use `--vm-type vz --vz-rosetta` flags when starting
- **Docker Desktop**: Enable Rosetta in Settings > General
- Exclude `target/` and `.m2/` from file watchers (already configured in VS Code settings)

### Maven cache cleanup

If the Maven repository cache becomes corrupted:

```bash
# Remove the named volume (run on host, not in container)
docker volume rm vicario-maven-repo

# Then rebuild the container
```

### Tests fail with HeadlessException

If tests try to create GUI components and fail:

```bash
mvn clean install -Djava.awt.headless=true
```
