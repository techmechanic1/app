import { Either } from '@standardnotes/common'

import { HttpErrorResponseBody } from '../../Http/HttpErrorResponseBody'
import { HttpResponse } from '../../Http/HttpResponse'
import { SubscriptionInviteDeclineResponseBody } from './SubscriptionInviteDeclineResponseBody'

export interface SubscriptionInviteDeclineResponse extends HttpResponse {
  data: Either<SubscriptionInviteDeclineResponseBody, HttpErrorResponseBody>
}
