import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Info, ArrowRightLeft } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from './alert';

describe('Alert Component', () => {
  it('renders correctly in composable mode with AlertTitle and AlertDescription', () => {
    render(
      <Alert>
        <Info data-testid="info-icon" />
        <AlertTitle>Pemberitahuan</AlertTitle>
        <AlertDescription>Ini adalah deskripsi alert composable.</AlertDescription>
      </Alert>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    expect(screen.getByText('Pemberitahuan')).toBeInTheDocument();
    expect(screen.getByText('Ini adalah deskripsi alert composable.')).toBeInTheDocument();
  });

  it('renders correctly in direct prop mode with icon and title (PO Emas Lokal pattern)', () => {
    render(
      <Alert
        variant="success"
        icon={<ArrowRightLeft data-testid="custom-icon" />}
        title="Alur 2-Tahap Akuntansi & Kontrol Fisik Brankas PT TAN"
      >
        <p>Tahap 1: Debet 1159 vs Kredit Kas/Bank</p>
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('flex');
    expect(alert).toHaveClass('border-emerald/30');

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByText('Alur 2-Tahap Akuntansi & Kontrol Fisik Brankas PT TAN')).toBeInTheDocument();
    expect(screen.getByText('Tahap 1: Debet 1159 vs Kredit Kas/Bank')).toBeInTheDocument();
  });

  it('renders default icon for variant when no custom icon is passed in prop mode', () => {
    render(
      <Alert variant="info" title="Purchase Order Telah Diterbitkan">
        Dokumen PR telah dikonversi.
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('border-sky/30');
    expect(screen.getByText('Purchase Order Telah Diterbitkan')).toBeInTheDocument();
    expect(screen.getByText('Dokumen PR telah dikonversi.')).toBeInTheDocument();
    // Default icon (svg) is rendered
    expect(alert.querySelector('svg')).toBeInTheDocument();
  });

  it('respects hideIcon prop in direct prop mode', () => {
    render(
      <Alert variant="warning" hideIcon title="Peringatan">
        Pesan tanpa ikon
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert.querySelector('svg')).toBeNull();
    expect(screen.getByText('Peringatan')).toBeInTheDocument();
  });

  it('supports raw content without squishing into column 1', () => {
    render(
      <Alert variant="destructive">
        <span>Pesan kesalahan langsung tanpa AlertDescription</span>
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('flex');
    expect(alert).toHaveClass('border-danger/30');
    expect(
      screen.getByText('Pesan kesalahan langsung tanpa AlertDescription')
    ).toBeInTheDocument();
  });
});
