import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Isi kartu</Card>);
    expect(screen.getByText('Isi kartu')).toBeInTheDocument();
  });

  it('is padded by default and unpadded with noPadding', () => {
    const { rerender } = render(<Card data-testid="card">Isi</Card>);
    expect(screen.getByTestId('card')).toHaveClass('p-6');

    rerender(
      <Card data-testid="card" noPadding>
        Isi
      </Card>,
    );
    expect(screen.getByTestId('card')).not.toHaveClass('p-6');
  });

  it('applies custom className', () => {
    render(
      <Card data-testid="card" className="custom-class">
        Isi
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveClass('custom-class');
  });

  it('renders CardTitle as a heading', () => {
    render(<CardTitle>Judul</CardTitle>);
    expect(screen.getByRole('heading', { name: 'Judul', level: 3 })).toBeInTheDocument();
  });

  it('composes header, content and footer', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan</CardTitle>
          <CardDescription>Deskripsi singkat</CardDescription>
        </CardHeader>
        <CardContent>Konten</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByRole('heading', { name: 'Ringkasan' })).toBeInTheDocument();
    expect(screen.getByText('Deskripsi singkat')).toBeInTheDocument();
    expect(screen.getByText('Konten')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});
