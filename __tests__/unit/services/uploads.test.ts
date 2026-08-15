import * as ImagePicker from 'expo-image-picker'
import { pickFromCamera } from '@/services/uploads'

const mockRequestCameraPermissions = ImagePicker.requestCameraPermissionsAsync as jest.Mock
const mockLaunchCamera = ImagePicker.launchCameraAsync as jest.Mock

describe('pickFromCamera', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects with CAMERA_PERMISSION_DENIED when the OS can still ask again', async () => {
    mockRequestCameraPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: true })
    await expect(pickFromCamera()).rejects.toThrow('CAMERA_PERMISSION_DENIED')
    expect(mockLaunchCamera).not.toHaveBeenCalled()
  })

  it('rejects with CAMERA_PERMISSION_BLOCKED when the permission is permanently denied', async () => {
    mockRequestCameraPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: false })
    await expect(pickFromCamera()).rejects.toThrow('CAMERA_PERMISSION_BLOCKED')
    expect(mockLaunchCamera).not.toHaveBeenCalled()
  })

  it('proceeds to launch the camera when permission is granted', async () => {
    mockRequestCameraPermissions.mockResolvedValueOnce({ granted: true })
    mockLaunchCamera.mockResolvedValueOnce({ canceled: true, assets: [] })
    await expect(pickFromCamera()).resolves.toBeNull()
    expect(mockLaunchCamera).toHaveBeenCalledTimes(1)
  })
})
