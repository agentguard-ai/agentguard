import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';

describe('ConnectionStatusIndicator', () => {
  it('should show green dot and "Connected" when status is connected', { timeout: 15000 }, () => {
    render(<ConnectionStatusIndicator status="connected" />);

    expect(screen.getByText('Connected')).toBeDefined();
    const dot = screen.getByRole('status').querySelector('span[aria-hidden="true"]');
    expect(dot?.className).toContain('bg-green-500');
  });

  it('should show amber dot and "Reconnecting..." when status is reconnecting', () => {
    render(<ConnectionStatusIndicator status="reconnecting" />);

    expect(screen.getByText('Reconnecting...')).toBeDefined();
    const dot = screen.getByRole('status').querySelector('span[aria-hidden="true"]');
    expect(dot?.className).toContain('bg-amber-500');
    expect(dot?.className).toContain('animate-pulse');
  });

  it('should show red dot and "Disconnected" when status is disconnected', () => {
    render(<ConnectionStatusIndicator status="disconnected" />);

    expect(screen.getByText('Disconnected')).toBeDefined();
    const dot = screen.getByRole('status').querySelector('span[aria-hidden="true"]');
    expect(dot?.className).toContain('bg-red-500');
  });

  it('should show amber dot and "Polling" when disconnected with polling active', () => {
    render(<ConnectionStatusIndicator status="disconnected" isPolling={true} />);

    expect(screen.getByText('Polling')).toBeDefined();
    const dot = screen.getByRole('status').querySelector('span[aria-hidden="true"]');
    expect(dot?.className).toContain('bg-amber-500');
  });

  it('should have appropriate aria-label for connected state', () => {
    render(<ConnectionStatusIndicator status="connected" />);

    const statusElement = screen.getByRole('status');
    expect(statusElement.getAttribute('aria-label')).toBe('WebSocket connected');
  });

  it('should have appropriate aria-label for reconnecting state', () => {
    render(<ConnectionStatusIndicator status="reconnecting" />);

    const statusElement = screen.getByRole('status');
    expect(statusElement.getAttribute('aria-label')).toBe('WebSocket reconnecting');
  });

  it('should have appropriate aria-label for disconnected state', () => {
    render(<ConnectionStatusIndicator status="disconnected" />);

    const statusElement = screen.getByRole('status');
    expect(statusElement.getAttribute('aria-label')).toBe('WebSocket disconnected');
  });

  it('should have appropriate aria-label for polling fallback state', () => {
    render(<ConnectionStatusIndicator status="disconnected" isPolling={true} />);

    const statusElement = screen.getByRole('status');
    expect(statusElement.getAttribute('aria-label')).toBe(
      'WebSocket disconnected, using polling fallback'
    );
  });

  it('should not pulse the dot when connected', () => {
    render(<ConnectionStatusIndicator status="connected" />);

    const dot = screen.getByRole('status').querySelector('span[aria-hidden="true"]');
    expect(dot?.className).not.toContain('animate-pulse');
  });

  it('should pulse the dot when reconnecting', () => {
    render(<ConnectionStatusIndicator status="reconnecting" />);

    const dot = screen.getByRole('status').querySelector('span[aria-hidden="true"]');
    expect(dot?.className).toContain('animate-pulse');
  });
});
