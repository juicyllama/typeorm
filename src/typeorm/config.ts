import { Env } from '@juicyllama/utils'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import 'dotenv/config'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { SnakeNamingStrategy } from 'typeorm-naming-strategies'

interface BuildTypeOrmConfigOptions {
    /**
     * Force using TypeScript sources (useful for CLI migration:generate).
     * Defaults to true only when this file itself is executed as TS.
     */
    useTs?: boolean
}

export const buildTypeOrmConfig = (
    databaseUrl?: string,
    options: BuildTypeOrmConfigOptions = {}
): TypeOrmModuleOptions => {
    const url = databaseUrl ?? process.env.DATABASE_URL

    if (!url) {
        throw new Error('DATABASE_URL is not defined')
    }

    // Default to TS only when this file itself is executed as TS; otherwise prefer compiled JS.
    const useTs = options.useTs ?? __filename.endsWith('.ts')
    const fileExt = useTs ? 'ts' : 'js'
    const buildDir = useTs ? 'src' : 'dist'
    const projectRoot = findProjectRoot()

    return {
        type: 'mysql',
        url,
        autoLoadEntities: true,
        entities: [`${projectRoot}/packages/data/${buildDir}/**/*.entity.${fileExt}`],
        migrationsRun: false,
        migrations: [`${projectRoot}/packages/data/${buildDir}/migrations/*.${fileExt}`],
        synchronize: false,
        poolSize: 5, // Reduced pool size
        connectTimeout: 60000, // Increased timeout
        logging: Env.IsProd() ? ['error', 'warn'] : false,
        namingStrategy: new SnakeNamingStrategy(),
    }
}

export function findProjectRoot(startPath: string = __dirname): string {
    let currentPath = startPath

    while (currentPath !== dirname(currentPath)) {
        if (existsSync(join(currentPath, 'package.json')) && existsSync(join(currentPath, 'turbo.json'))) {
            return currentPath
        }
        currentPath = dirname(currentPath)
    }

    throw new Error('Could not find project root')
}
