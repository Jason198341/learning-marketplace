import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { CartDrawer } from './CartDrawer';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <CartDrawer />
    </div>
  );
}

export default MainLayout;
