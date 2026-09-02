declare module '*.jsx' {
  import type { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module './CertificatesInput' {
  import type { ComponentType } from 'react';
  const CertificatesInput: ComponentType<any>;
  export default CertificatesInput;
  export const CertificatesInputNamed: any;
  export const splitBarWeights: any;
  export const autoCalculateCertificates: any;
  export const barWeightOptions: any;
  export const barWeightLabel: any;
  export const BAR_WEIGHTS: any;
}
