import { findOneOptions, findOneOptionsWrapper, findOptions } from './TypeOrm'

function repository(): any {
    return {
        metadata: {
            columns: [
                { propertyName: 'id', isPrimary: true },
                { propertyName: 'name', isPrimary: false },
            ],
            relations: [{ propertyName: 'teams' }, { propertyName: 'owner' }],
        },
    }
}

describe('find option helpers', () => {
    it('turns comma-separated select and relations into TypeORM 1 objects', () => {
        const options = findOptions({ select: 'id,missing', relations: 'teams,owner.user', limit: 5 }, { id: 1 }, 'id')

        expect(options.select).toEqual({ id: true, missing: true })
        expect(options.relations).toEqual({ teams: true, owner: { user: true } })
        expect(options.take).toBe(5)
    })

    it('keeps an explicit empty relations list empty and drops select fields that are not columns', () => {
        const options = findOneOptionsWrapper(repository(), {
            relations: [],
            select: ['id', 'missing'],
        } as any)

        expect(options.relations).toEqual({})
        expect(options.select).toEqual({ id: true })
    })

    it('loads every relation when the caller does not set relations', () => {
        const options = findOneOptionsWrapper(repository(), { where: { id: 1 } })

        expect(options.relations).toEqual({ teams: true, owner: true })
    })

    it('converts a string array of relations before it reaches the repository', () => {
        const options = findOneOptionsWrapper(repository(), { relations: ['teams'] } as any)

        expect(options.relations).toEqual({ teams: true })
    })

    it('omits select and relations when a single-record query does not ask for them', () => {
        const options = findOneOptions({}, { id: 1 })

        expect(options.select).toBeUndefined()
        expect(options.relations).toBeUndefined()
        expect(options.where).toEqual({ id: 1 })
    })
})
