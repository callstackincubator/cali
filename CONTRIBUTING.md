# Contributing

This project uses Bun. Make sure you have it installed.

## Install the dependencies

```bash
$ bun install
```

## Building the project

```bash
$ bun run prepare
```

## Linking the project as global CLI

```bash
$ bun link
```

## Running the project

In development, you can run the project with:

```bash
$ bun <path_to_project>/src/cli.ts
```

or from global installation, if you have linked the project:

```bash
$ bun --bun run cali
```

Additional flag `--bun` is required due to shebang line in the CLI pointing to Node.

> [!NOTE]
> In case of running from global installation, you should start bun in watch mode, so that dist files are automatically up to date with your latest changes.
