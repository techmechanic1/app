import ModalDialog from '@/Components/Shared/ModalDialog'
import ModalDialogButtons from '@/Components/Shared/ModalDialogButtons'
import ModalDialogDescription from '@/Components/Shared/ModalDialogDescription'
import ModalDialogLabel from '@/Components/Shared/ModalDialogLabel'
import Button from '@/Components/Button/Button'
import { FunctionComponent, useState } from 'react'
import { WebApplication } from '@/Application/Application'
import { useBeforeUnload } from '@/Hooks/useBeforeUnload'
import ChangeEmailForm from './ChangeEmailForm'
import ChangeEmailSuccess from './ChangeEmailSuccess'

enum SubmitButtonTitles {
  Default = 'Continue',
  GeneratingKeys = 'Generating Keys...',
  Finish = 'Finish',
}

enum Steps {
  InitialStep,
  FinishStep,
}

type Props = {
  onCloseDialog: () => void
  application: WebApplication
}

const ChangeEmail: FunctionComponent<Props> = ({ onCloseDialog, application }) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [isContinuing, setIsContinuing] = useState(false)
  const [lockContinue, setLockContinue] = useState(false)
  const [submitButtonTitle, setSubmitButtonTitle] = useState(SubmitButtonTitles.Default)
  const [currentStep, setCurrentStep] = useState(Steps.InitialStep)

  useBeforeUnload()

  const applicationAlertService = application.alertService

  const validateCurrentPassword = async () => {
    if (!currentPassword || currentPassword.length === 0) {
      applicationAlertService.alert('Please enter your current password.').catch(console.error)

      return false
    }

    const success = await application.validateAccountPassword(currentPassword)
    if (!success) {
      applicationAlertService
        .alert('The current password you entered is not correct. Please try again.')
        .catch(console.error)

      return false
    }

    return success
  }

  const resetProgressState = () => {
    setSubmitButtonTitle(SubmitButtonTitles.Default)
    setIsContinuing(false)
  }

  const processEmailChange = async () => {
    await application.downloadBackup()

    setLockContinue(true)

    const response = await application.changeEmail(newEmail, currentPassword)

    const success = !response.error

    setLockContinue(false)

    return success
  }

  const dismiss = () => {
    if (lockContinue) {
      applicationAlertService.alert('Cannot close window until pending tasks are complete.').catch(console.error)
    } else {
      onCloseDialog()
    }
  }

  const handleSubmit = async () => {
    if (lockContinue || isContinuing) {
      return
    }

    if (currentStep === Steps.FinishStep) {
      dismiss()

      return
    }

    setIsContinuing(true)
    setSubmitButtonTitle(SubmitButtonTitles.GeneratingKeys)

    const valid = await validateCurrentPassword()

    if (!valid) {
      resetProgressState()

      return
    }

    const success = await processEmailChange()
    if (!success) {
      resetProgressState()

      return
    }

    setIsContinuing(false)
    setSubmitButtonTitle(SubmitButtonTitles.Finish)
    setCurrentStep(Steps.FinishStep)
  }

  const handleDialogClose = () => {
    if (lockContinue) {
      applicationAlertService.alert('Cannot close window until pending tasks are complete.').catch(console.error)
    } else {
      onCloseDialog()
    }
  }

  return (
    <div>
      <ModalDialog>
        <ModalDialogLabel closeDialog={handleDialogClose}>Change Email</ModalDialogLabel>
        <ModalDialogDescription className="flex flex-row items-center px-4.5">
          {currentStep === Steps.InitialStep && (
            <ChangeEmailForm setNewEmail={setNewEmail} setCurrentPassword={setCurrentPassword} />
          )}
          {currentStep === Steps.FinishStep && <ChangeEmailSuccess />}
        </ModalDialogDescription>
        <ModalDialogButtons className="px-4.5">
          <Button className="min-w-20" primary label={submitButtonTitle} onClick={handleSubmit} />
        </ModalDialogButtons>
      </ModalDialog>
    </div>
  )
}

export default ChangeEmail
