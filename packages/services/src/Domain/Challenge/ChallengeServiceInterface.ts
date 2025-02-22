import { RootKeyInterface } from '@standardnotes/models'

import { AbstractService } from '../Service/AbstractService'
import { ChallengeInterface } from './ChallengeInterface'
import { ChallengePromptInterface } from './Prompt/ChallengePromptInterface'
import { ChallengeResponseInterface } from './ChallengeResponseInterface'
import { ChallengeReason } from './Types/ChallengeReason'

export interface ChallengeServiceInterface extends AbstractService {
  /**
   * Resolves when the challenge has been completed.
   * For non-validated challenges, will resolve when the first value is submitted.
   */
  promptForChallengeResponse(challenge: ChallengeInterface): Promise<ChallengeResponseInterface | undefined>
  createChallenge(
    prompts: ChallengePromptInterface[],
    reason: ChallengeReason,
    cancelable: boolean,
    heading?: string,
    subheading?: string,
  ): ChallengeInterface
  completeChallenge(challenge: ChallengeInterface): void
  promptForAccountPassword(): Promise<boolean>
  getWrappingKeyIfApplicable(passcode?: string): Promise<
    | {
        canceled?: undefined
        wrappingKey?: undefined
      }
    | {
        canceled: boolean
        wrappingKey?: undefined
      }
    | {
        wrappingKey: RootKeyInterface
        canceled?: undefined
      }
  >
}
