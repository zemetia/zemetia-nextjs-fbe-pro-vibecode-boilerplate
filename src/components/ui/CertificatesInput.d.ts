import type { ComponentType } from 'react';

declare const CertificatesInput: ComponentType<{
  value?: any;
  onChange?: (val: any) => void;
  targetWeight?: number;
  weightUnit?: string;
  [key: string]: any;
}>;

export default CertificatesInput;
export { CertificatesInput, CertificatesInput as CertificatesInputNamed };
export const splitBarWeights: any;
export const autoCalculateCertificates: any;
export const barWeightOptions: any;
export const barWeightLabel: any;
export const BAR_WEIGHTS: any;
