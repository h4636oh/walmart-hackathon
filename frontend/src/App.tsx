import { Routes, Route } from 'react-router-dom';
import Home from './routes/Home.tsx';
import CheckShipment from './routes/CheckShipment.tsx';
import CreateShipment from './routes/CreateShipment.tsx';

import './App.css'

function App() {

  return (
    <div className="overflow-x-hidden">
    <Routes>
      <Route path='/' element={<Home/>} />
      <Route path='/check-shipment' element={<CheckShipment />} />
      <Route path='/create-shipment' element={<CreateShipment />} />
      <Route path='*' element={<div className='h-dvh w-dvw text-center'>404 Not Found</div>} />
    </Routes>
    </div>
  )
}

export default App
