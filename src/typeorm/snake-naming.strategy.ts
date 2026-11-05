import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm'

/**
 * Same snake_case rules as typeorm-naming-strategies 4.1.0.
 * That package peers typeorm ^0.3 only, and its names are already in the database,
 * so this copy keeps table and column names stable on typeorm 1.
 */
function snakeCase(value: string): string {
    return value
        .replace(/([A-Z])([A-Z])([a-z])/g, '$1_$2$3')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase()
}

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
    override tableName(className: string, customName: string | undefined): string {
        return customName ?? snakeCase(className)
    }

    override columnName(propertyName: string, customName: string | undefined, embeddedPrefixes: string[]): string {
        return snakeCase(embeddedPrefixes.concat('').join('_')) + (customName ?? snakeCase(propertyName))
    }

    override relationName(propertyName: string): string {
        return snakeCase(propertyName)
    }

    override joinColumnName(relationName: string, referencedColumnName: string): string {
        return snakeCase(relationName + '_' + referencedColumnName)
    }

    override joinTableName(
        firstTableName: string,
        secondTableName: string,
        firstPropertyName: string,
        secondPropertyName: string
    ): string {
        // 4.1.0 ignored the second property name. Keep that so existing join tables stay put.
        void secondPropertyName
        return snakeCase(firstTableName + '_' + firstPropertyName.replace(/\./gi, '_') + '_' + secondTableName)
    }

    override joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
        return snakeCase(tableName + '_' + (columnName ?? propertyName))
    }

    classTableInheritanceParentColumnName(parentTableName: string, parentTableIdPropertyName: string): string {
        return snakeCase(parentTableName + '_' + parentTableIdPropertyName)
    }

    eagerJoinRelationAlias(alias: string, propertyPath: string): string {
        return alias + '__' + propertyPath.replace('.', '_')
    }
}
