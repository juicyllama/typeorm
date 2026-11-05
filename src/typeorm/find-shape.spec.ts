import { pathsToFindObject, toFindObject } from './find-shape'

describe('pathsToFindObject', () => {
    it('turns a list of relations into TypeORM 1 object form', () => {
        expect(pathsToFindObject(['teams'])).toEqual({ teams: true })
    })

    it('nests dotted paths and keeps a deeper path when a shorter one is also present', () => {
        expect(pathsToFindObject(['owner.user', 'owner'])).toEqual({ owner: { user: true } })
        expect(pathsToFindObject(['owner', 'owner.user'])).toEqual({ owner: { user: true } })
    })

    it('turns an explicit empty list into an empty object', () => {
        expect(pathsToFindObject([])).toEqual({})
    })

    it('ignores blank segments', () => {
        expect(pathsToFindObject(['', '  ', 'teams'])).toEqual({ teams: true })
    })
})

describe('toFindObject', () => {
    it('splits a comma-separated query value', () => {
        expect(toFindObject('id,name')).toEqual({ id: true, name: true })
        expect(toFindObject('teams,owner.user')).toEqual({ teams: true, owner: { user: true } })
    })

    it('leaves an object as it is', () => {
        expect(toFindObject({ teams: true })).toEqual({ teams: true })
    })

    it('returns undefined when the caller omitted the option', () => {
        expect(toFindObject(undefined)).toBeUndefined()
        expect(toFindObject(null)).toBeUndefined()
        expect(toFindObject('')).toBeUndefined()
    })
})
