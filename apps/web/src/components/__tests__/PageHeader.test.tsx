import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageHeader } from '../PageHeader';

describe('PageHeader Component', () => {
  it('renders the title correctly', () => {
    render(<PageHeader title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders the description if provided', () => {
    render(<PageHeader title="Test Title" description="Test Description" />);
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('renders actions if provided', () => {
    render(
      <PageHeader
        title="Test Title"
        actions={<button>Click Me</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
  });
});
