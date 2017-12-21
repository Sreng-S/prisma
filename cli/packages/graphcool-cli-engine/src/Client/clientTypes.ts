export interface DeployPayload {
  errors: SchemaError[]
  migration: Migration
}

export interface SchemaError {
  type: string
  field?: string
  description: string
}

export interface Migration {
  revision: number
  hasBeenApplied: boolean
  steps: MigrationStep[]
}

export interface MigrationStep {
  type: string
  __typename?: string | null
  name: string
  // createEnum
  ce_values?: string[] | null
  // createField
  cf_typeName?: string | null
  cf_isRequired?: boolean | null
  cf_isList?: boolean | null
  cf_isUnique?: boolean | null
  cf_relation?: string | null
  cf_defaultValue?: string | null
  cf_enum?: string | null
  // createRelation
  leftModel?: string | null
  rightModel?: string | null
  // deleteField
  model?: string | null
  // updateEnum
  newName?: string | null
  values?: string[] | null
  // updateField
  typeName?: string | null
  isUnique?: boolean | null
  isRequried?: boolean | null
  isList?: boolean | null
  isRequired?: boolean | null
  relation?: string | null
  defaultValue?: string | null
  enum?: string | null
  // updateModel
  um_newName?: string | null
}