export enum UploadType {
    CSV = 'CSV',
    JSON = 'JSON',
}

export enum HTTP_METHODS {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH',
    DELETE = 'DELETE',
}

export enum CRUD_ACTIONS {
    CREATE = 'CREATE',
    READ = 'READ',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
}

export enum METHOD {
    CREATE = 'CREATE', // CREATE
    GET = 'GET', // READ ONE
    LIST = 'LIST', //  READ MANY
    COUNT = 'COUNT', // READ MANY COUNT
    POST = 'POST', // ALIAS FOR CREATE
    PUT = 'PUT', // CREATE OR UPDATE
    UPDATE = 'UPDATE', // UPDATE
    UPLOAD = 'UPLOAD', // UPLOAD
    PATCH = 'PATCH', // UPDATE
    DELETE = 'DELETE', // DELETE
    CHARTS = 'CHARTS', //  READ MANY
}

export interface PromiseLoopOutcomes<T> {
    total: number
    success: number
    failed: number
    failures?: PromiseSettledResult<T>[]
}

export enum ImportMode {
    CREATE = 'CREATE',
    UPSERT = 'UPSERT',
    DELETE = 'DELETE',
    REPOPULATE = 'REPOPULATE',
}

export class BulkUploadResponse {
    total!: number
    processed!: number
    created!: number
    updated!: number
    deleted!: number
    errored!: number
    errors?: unknown[]
    ids!: number[]
}

export interface ChartResult {
    count: number
    [key: string]: unknown
    time_interval: Date
}
