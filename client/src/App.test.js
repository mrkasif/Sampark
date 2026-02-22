import { render, screen } from '@testing-library/react';
import App from './App';

test('renders startup landing page', () => {
  render(<App />);
  expect(screen.getByText(/buy & sell within 5km/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /start exploring/i })).toBeInTheDocument();
});
