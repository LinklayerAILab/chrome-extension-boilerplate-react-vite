import { ReactNode } from 'react';

const bot = chrome.runtime.getURL('content-ui/coinHeader/bot.svg');
const bill = chrome.runtime.getURL('content-ui/coinHeader/bill.svg');

interface TrackerHeaderProps {
  title: string | ReactNode;
  desc: string | ReactNode;
}

export const TrackerHeader = (props: TrackerHeaderProps) => {
  return (
    <div className="m-4 flex h-[135px] gap-4 rounded-[8px] border-[2px] border-solid border-black bg-[#F9FFE2] p-6">
      <div>
        <img src={bot} className="w-[74px]"></img>
      </div>
      <div className="flex w-full items-center text-[12px]">
        <div className="w-full font-bold">
          <div>{props.title}</div>
          <div className="my-[14px] h-[2px] bg-black"></div>
          <div className="flex items-center gap-2">
            {props.desc} <img src={bill} alt="" />
          </div>
        </div>
      </div>
    </div>
  );
};
