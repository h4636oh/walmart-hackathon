import React from 'react';

const Home: React.FC = () => {
  return (
    <div className='flex flex-col justify-center-safe items-center m-auto gap-8 bg-nord-polarNight-0 text-nord-snowStorm-2 w-dvw h-dvh'>
      <div 
        className='p-4 bg-nord-aurora-green rounded-xl w-60 text-center cursor-pointer font-bold'
        onClick={() => window.location.href = '/create-shipment'}
      >
        Create New Shipment
      </div>
      <div
        className='p-4 bg-nord-frost-1 rounded-xl w-60 text-center cursor-pointer font-bold'
        onClick={() => window.location.href = '/check-shipment'}
      >
        Check Created Shipment
      </div>
    </div>
  )
}

export default Home;