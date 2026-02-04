import 'dotenv/config'
import { DataSource, DataSourceOptions } from 'typeorm'

import { buildTypeOrmConfig } from './config'

// Force TS sources for migration:generate so schema diffs see latest code without a pre-build.
export default new DataSource(buildTypeOrmConfig(undefined, { useTs: true }) as DataSourceOptions)
