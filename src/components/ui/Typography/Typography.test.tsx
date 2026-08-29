import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Typography } from './Typography';

describe('Typography', () => {
  it('renders a paragraph by default', () => {
    render(<Typography>Teks biasa</Typography>);
    expect(screen.getByText('Teks biasa').tagName).toBe('P');
  });

  it.each([
    ['h1', 1],
    ['h2', 2],
    ['h3', 3],
    ['h4', 4],
    ['h5', 5],
    ['h6', 6],
  ] as const)('renders %s as a real heading', (variant, level) => {
    render(<Typography variant={variant}>Judul</Typography>);
    expect(screen.getByRole('heading', { name: 'Judul', level })).toBeInTheDocument();
  });

  it('maps non-heading variants to their semantic element', () => {
    const { rerender } = render(<Typography variant="small">Kecil</Typography>);
    expect(screen.getByText('Kecil').tagName).toBe('SMALL');

    rerender(<Typography variant="code">npm run lint</Typography>);
    expect(screen.getByText('npm run lint').tagName).toBe('CODE');

    rerender(<Typography variant="muted">Redup</Typography>);
    expect(screen.getByText('Redup').tagName).toBe('P');
  });

  it('honours the `as` override', () => {
    render(
      <Typography variant="h1" as="span">
        Tampil besar, bukan heading
      </Typography>,
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Tampil besar, bukan heading').tagName).toBe('SPAN');
  });

  it('applies custom className', () => {
    render(<Typography className="custom-class">Teks</Typography>);
    expect(screen.getByText('Teks')).toHaveClass('custom-class');
  });
});
