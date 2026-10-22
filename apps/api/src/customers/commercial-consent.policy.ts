import {
  CommercialConsentChannel,
  CommercialConsentSource,
} from "@prisma/client";

export const COMMERCIAL_CONSENT_VERSION = "commercial-v1";

export const COMMERCIAL_CONSENT_CHANNELS = [
  CommercialConsentChannel.EMAIL,
  CommercialConsentChannel.SMS,
  CommercialConsentChannel.WHATSAPP,
] as const;

export function registrationConsentRecords(
  selectedChannels: CommercialConsentChannel[] = [],
  recordedAt = new Date(),
) {
  const selected = new Set(selectedChannels);

  return COMMERCIAL_CONSENT_CHANNELS.map((channel) => {
    const granted = selected.has(channel);
    return {
      channel,
      grantedAt: granted ? recordedAt : null,
      withdrawnAt: granted ? null : recordedAt,
      consentVersion: COMMERCIAL_CONSENT_VERSION,
      source: CommercialConsentSource.REGISTRATION,
      withdrawalSource: granted ? null : CommercialConsentSource.REGISTRATION,
    };
  });
}
