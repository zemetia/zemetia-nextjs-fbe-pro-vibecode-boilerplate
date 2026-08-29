import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Aktif</Badge>);
    expect(screen.getByText('Aktif')).toBeInTheDocument();
  });

  it('exposes an accessible name when given a role', () => {
    render(
      <Badge role="status" aria-label="Status pengguna">
        Nonaktif
      </Badge>,
    );
    expect(screen.getByRole('status', { name: 'Status pengguna' })).toBeInTheDocument();
  });

  it('renders the dot as decorative so it adds nothing to the text', () => {
    render(
      <Badge role="status" dot>
        Aktif
      </Badge>,
    );
    // `status` takes its accessible name from aria-label, not from contents
    // (covered above), so assert on the text the dot must not pollute.
    expect(screen.getByRole('status')).toHaveTextContent('Aktif');
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it('omits the dot by default', () => {
    render(<Badge>Aktif</Badge>);
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('applies custom className', () => {
    render(<Badge className="custom-class">Aktif</Badge>);
    expect(screen.getByText('Aktif')).toHaveClass('custom-class');
  });
});
