import { existsSync } from 'node:fs'
import type { Format, UserConfig } from 'tsdown'
import { globSync } from 'tinyglobby'
// import solid from '@rolldown-plugin/solid'
import solid from 'unplugin-solid/rolldown'

type ExternalItem = string | RegExp

const baseExternals: ExternalItem[] = ['solid-js', /@s-primitives\/.*/]

interface CreateTsDownConfigOptions {
  copy?: UserConfig['copy']
  cwd?: string
  dts?: UserConfig['dts']
  external?: ExternalItem[]
  minify?: boolean
  submodules?: boolean
  target?: UserConfig['target']
  dir?: string
}

export function createTsDownConfig(options: CreateTsDownConfigOptions = {}) {
  const cwd = options.cwd ?? process.cwd()
  const { copy, dts = true, external = [], minify = true, submodules, target = 'es2015', dir = 'src' } = options

  const root = (dir ? `${cwd}/${dir}` : cwd).replace(/\\/g, '/')
  const rootEntry = dir ? `${dir}/index.ts` : 'index.ts'

  const entries: Record<string, string> = {
    index: rootEntry,
  }

  if (submodules && existsSync(root)) {
    for (const path of globSync(['*/index.ts', '*/index.tsx'], {
      cwd: root,
      onlyFiles: true,
    })) {
      const [name] = path.split('/')
      if (!name || name.startsWith('_') || name.startsWith('.')) continue
      entries[name] = dir ? `${dir}/${path}` : path
    }
  }

  const baseConfig: UserConfig = {
    target,
    plugins: [solid()],
    dts,
    platform: 'browser',
    deps: {
      neverBundle: [...baseExternals, ...external],
    },
  }

  const formats = ['cjs', 'esm'] as Format[]
  const configs: UserConfig[] = []

  formats.forEach(format => {
    const isEs = format === 'esm'
    const ext = isEs ? 'js' : 'cjs'

    configs.push({
      ...baseConfig,
      entry: entries,
      format,
      dts: isEs,
      copy: configs.length === 0 ? copy : undefined,
      outExtensions: () => ({
        js: `.${ext}`,
        dts: isEs ? '.d.ts' : undefined,
      }),
    })

    if (rootEntry && minify) {
      configs.push({
        ...baseConfig,
        entry: entries,
        format,
        dts: false,
        minify: true,
        outExtensions: () => ({
          js: `.min.${ext}`,
        }),
      })
    }
  })

  return configs
}
