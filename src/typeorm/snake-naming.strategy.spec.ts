import { SnakeNamingStrategy } from './snake-naming.strategy'

describe('SnakeNamingStrategy', () => {
    const strategy = new SnakeNamingStrategy()

    it('snake-cases class and property names the way typeorm-naming-strategies 4.1.0 did', () => {
        expect(strategy.tableName('VerifactuDocument', undefined)).toBe('verifactu_document')
        expect(strategy.tableName('Document', 'documents')).toBe('documents')
        expect(strategy.columnName('createdAt', undefined, [])).toBe('created_at')
        expect(strategy.columnName('name', 'full_name', [])).toBe('full_name')
        expect(strategy.columnName('city', undefined, ['fromAddress'])).toBe('from_address_city')
        expect(strategy.relationName('lineItems')).toBe('line_items')
        expect(strategy.joinColumnName('team', 'id')).toBe('team_id')
        expect(strategy.joinTableColumnName('document', 'tag', undefined)).toBe('document_tag')
        expect(strategy.joinTableName('document', 'tag', 'tags', 'documents')).toBe('document_tags_tag')
    })
})
