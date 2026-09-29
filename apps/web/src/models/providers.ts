export interface ProviderConfig {
  id: string;
  capabilityKey: string;
  providerType: string;
  name: string;
  authMode: string;
  isDefault: boolean;
  isActive: boolean;
  hasSecret: boolean;
  scope: string;
}
