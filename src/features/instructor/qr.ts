// QR codes are drawn in the browser (the `qrcode` library, MIT); nothing is sent anywhere.
import QRCode from 'qrcode'

/** A PNG data URL for `text`, or null if it cannot be drawn. */
export async function qrDataUrl(text: string, size = 160): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M' })
  } catch {
    return null
  }
}
