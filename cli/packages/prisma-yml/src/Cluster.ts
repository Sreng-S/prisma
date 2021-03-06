const debug = require('debug')('environment')
import 'isomorphic-fetch'
import * as jwt from 'jsonwebtoken'
import { cloudApiEndpoint } from './constants'
import { GraphQLClient } from 'graphql-request'
import chalk from 'chalk'
import { isLocal } from './Environment'
import { IOutput } from './Output'

export class Cluster {
  name: string
  baseUrl: string
  local: boolean
  shared: boolean
  clusterSecret?: string
  requiresAuth: boolean
  out: IOutput
  isPrivate: boolean
  workspaceSlug?: string
  private cachedToken?: string
  constructor(
    out: IOutput,
    name: string,
    baseUrl: string,
    clusterSecret?: string,
    local: boolean = true,
    shared: boolean = false,
    isPrivate: boolean = false,
    workspaceSlug?: string,
  ) {
    this.out = out
    this.name = name
    this.baseUrl = baseUrl
    this.clusterSecret = clusterSecret
    this.local = local
    this.shared = shared
    this.isPrivate = isPrivate
    this.workspaceSlug = workspaceSlug
  }

  async getToken(
    serviceName: string,
    workspaceSlug?: string,
    stageName?: string,
  ): Promise<string | null> {
    // public clusters just take the token
    if (this.name === 'shared-public-demo') {
      return ''
    }
    if (this.shared || this.isPrivate) {
      return this.generateClusterToken(serviceName, workspaceSlug, stageName)
    } else {
      return this.getLocalToken()
    }
  }

  getLocalToken(): string | null {
    if (!this.clusterSecret || this.clusterSecret === '') {
      const localNote = isLocal(this.baseUrl)
        ? `Please either provide a clusterSecret or run ${chalk.green.bold(
            'prisma local start',
          )} to generate a new one. `
        : ''

      this.out.warn(
        `Property '${chalk.bold('clusterSecret')}' of cluster ${chalk.bold(
          this.name,
        )} in ~/.prisma/config.yml is empty. ${localNote}Read more here https://bit.ly/prisma-graphql-config-yml`,
      )
      return null
    }
    if (!this.cachedToken) {
      const grants = [{ target: `*/*`, action: '*' }]

      try {
        this.cachedToken = jwt.sign({ grants }, this.clusterSecret, {
          expiresIn: '10 minutes',
          algorithm: 'RS256',
        })
      } catch (e) {
        throw new Error(
          `Could not generate token for local cluster ${chalk.bold(
            this.name,
          )}. ${e.message}`,
        )
      }
    }

    return this.cachedToken!
  }

  get cloudClient() {
    return new GraphQLClient(cloudApiEndpoint, {
      headers: {
        Authorization: `Bearer ${this.clusterSecret}`,
      },
    })
  }

  async generateClusterToken(
    serviceName: string,
    workspaceSlug: string = '*',
    stageName?: string,
  ): Promise<string> {
    const query = `
      mutation ($input: GenerateClusterTokenRequest!) {
        generateClusterToken(input: $input) {
          clusterToken
        }
      }
    `

    debug('generateClusterToken', cloudApiEndpoint)

    const {
      generateClusterToken: { clusterToken },
    } = await this.cloudClient.request<{
      generateClusterToken: {
        clusterToken: string
      }
    }>(query, {
      input: {
        workspaceSlug,
        clusterName: this.name,
        serviceName,
        stageName,
      },
    })

    debug('generated cluster token')

    return clusterToken
  }

  getApiEndpoint(serviceName: string, stage: string, workspaceSlug?: string) {
    if (this.isPrivate) {
      return `${this.baseUrl}/${serviceName}/${stage}`
    }
    const workspaceString = workspaceSlug ? `${workspaceSlug}/` : ''
    return `${this.baseUrl}/${workspaceString}${serviceName}/${stage}`
  }

  getWSEndpoint(serviceName: string, stage: string, workspaceSlug?: string) {
    if (this.isPrivate) {
      return `${this.baseUrl}/${serviceName}/${stage}`
    }
    const replacedUrl = this.baseUrl.replace('http', 'ws')
    const workspaceString = workspaceSlug ? `${workspaceSlug}/` : ''
    return `${replacedUrl}/${workspaceString}${serviceName}/${stage}`
  }

  getImportEndpoint(
    serviceName: string,
    stage: string,
    workspaceSlug?: string,
  ) {
    if (this.isPrivate) {
      return `${this.baseUrl}/${serviceName}/${stage}/import`
    }
    const workspaceString = workspaceSlug ? `${workspaceSlug}/` : ''
    return `${this.baseUrl}/${workspaceString}${serviceName}/${stage}/import`
  }

  getExportEndpoint(
    serviceName: string,
    stage: string,
    workspaceSlug?: string,
  ) {
    if (this.isPrivate) {
      return `${this.baseUrl}/${serviceName}/${stage}/export`
    }
    const workspaceString = workspaceSlug ? `${workspaceSlug}/` : ''
    return `${this.baseUrl}/${workspaceString}${serviceName}/${stage}/export`
  }

  getDeployEndpoint() {
    return `${this.baseUrl}/cluster`
  }

  async isOnline(): Promise<boolean> {
    const version = await this.getVersion()
    return Boolean(version)
  }

  async getVersion(): Promise<string | null> {
    try {
      const result = await fetch(this.getDeployEndpoint(), {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        } as any,
        body: JSON.stringify({
          query: `{
            clusterInfo {
              version
            }
          }`,
        }),
      })

      const { data } = await result.json()
      return data.clusterInfo.version
    } catch (e) {
      debug(e)
    }

    return null
  }
}
