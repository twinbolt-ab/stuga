import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SetupWizard } from '@/components/setup/SetupWizard'
import { isSetupComplete } from '@/lib/config'

export default function Setup() {
  const navigate = useNavigate()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    async function checkSetup() {
      const setupComplete = await isSetupComplete()
      if (setupComplete) {
        void navigate('/', { replace: true })
      } else {
        setIsReady(true)
      }
    }
    void checkSetup()
  }, [navigate])

  if (!isReady) {
    return <div className="flex-1 bg-background" />
  }

  return <SetupWizard />
}
