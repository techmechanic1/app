import { HttpServiceInterface } from '../../Http/HttpServiceInterface'
import {
  ListAuthenticatorsRequestParams,
  DeleteAuthenticatorRequestParams,
  VerifyAuthenticatorRegistrationResponseRequestParams,
  VerifyAuthenticatorAuthenticationResponseRequestParams,
} from '../../Request'
import {
  ListAuthenticatorsResponse,
  DeleteAuthenticatorResponse,
  GenerateAuthenticatorRegistrationOptionsResponse,
  VerifyAuthenticatorRegistrationResponseResponse,
  GenerateAuthenticatorAuthenticationOptionsResponse,
  VerifyAuthenticatorAuthenticationResponseResponse,
} from '../../Response'
import { AuthenticatorServerInterface } from './AuthenticatorServerInterface'
import { Paths } from './Paths'

export class AuthenticatorServer implements AuthenticatorServerInterface {
  constructor(private httpService: HttpServiceInterface) {}

  async list(params: ListAuthenticatorsRequestParams): Promise<ListAuthenticatorsResponse> {
    const response = await this.httpService.get(Paths.v1.listAuthenticators, params)

    return response as ListAuthenticatorsResponse
  }

  async delete(params: DeleteAuthenticatorRequestParams): Promise<DeleteAuthenticatorResponse> {
    const response = await this.httpService.delete(Paths.v1.deleteAuthenticator(params.authenticatorId), params)

    return response as DeleteAuthenticatorResponse
  }

  async generateRegistrationOptions(): Promise<GenerateAuthenticatorRegistrationOptionsResponse> {
    const response = await this.httpService.get(Paths.v1.generateRegistrationOptions)

    return response as GenerateAuthenticatorRegistrationOptionsResponse
  }

  async verifyRegistrationResponse(
    params: VerifyAuthenticatorRegistrationResponseRequestParams,
  ): Promise<VerifyAuthenticatorRegistrationResponseResponse> {
    const response = await this.httpService.post(Paths.v1.verifyRegistrationResponse, params)

    return response as VerifyAuthenticatorRegistrationResponseResponse
  }

  async generateAuthenticationOptions(): Promise<GenerateAuthenticatorAuthenticationOptionsResponse> {
    const response = await this.httpService.get(Paths.v1.generateAuthenticationOptions)

    return response as GenerateAuthenticatorAuthenticationOptionsResponse
  }

  async verifyAuthenticationResponse(
    params: VerifyAuthenticatorAuthenticationResponseRequestParams,
  ): Promise<VerifyAuthenticatorAuthenticationResponseResponse> {
    const response = await this.httpService.post(Paths.v1.verifyAuthenticationResponse, params)

    return response as VerifyAuthenticatorAuthenticationResponseResponse
  }
}
