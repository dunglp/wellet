import React from 'react';
import './ProcessBar.scss';

const ProcessBar = (props) => {
  const { percentage } = props;
  const index = Math.floor(percentage * 100);

  return (
    <div className='processBar'>
      {Array.from({ length: 100 }, (v, i) => i).map((v) =>
        v < index ? (
          <div className='bar green'></div>
        ) : (
          <div className='bar grey'></div>
        )
      )}
    </div>
  );
};

export default ProcessBar;
