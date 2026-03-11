import { useEffect } from 'react';
import { ICONS } from './lib/icons';
import { useI18n } from '@src/lib/i18n';
import { useSelector } from 'react-redux';
import { RootState } from '@src/store';
import { setSelectedMenuId } from '@src/store/slices/uiSlice';
import type { Store } from '@reduxjs/toolkit';

interface MenusProps {
  store?: Store;
}

export const Menus = ({ store }: MenusProps) => {
  const selectedId = useSelector((state: RootState) => state.ui.selectedMenuId);
  const { t } = useI18n();

  const menus = [
    {
      id: 7,
      title: t.menus?.token || 'Token',
      icon: ICONS.TOKEN,
      selectIcon: ICONS.TOKEN_SELECT,
    },
    {
      id: 1,
      title: t.menus?.alpha || 'Alpha',
      icon: ICONS.ALPHA,
      selectIcon: ICONS.ALPHA_SELECT,
    },

    {
      id: 2,
      title: t.menus?.api || 'Add API',
      icon: ICONS.API,
      selectIcon: ICONS.API_SELECT,
    },
    {
      id: 3,
      title: t.menus?.earn || 'Earn',
      icon: ICONS.MINT,
      selectIcon: ICONS.MINT_SELECT,
    },
    {
      id: 4,
      title: t.menus?.perps || 'Perps',
      icon: ICONS.PERPS,
      selectIcon: ICONS.PERPS_SELECT,
    },
    {
      id: 5,
      title: t.menus?.poliet || 'Poliet',
      icon: ICONS.POLIET,
      selectIcon: ICONS.POLIET_SELECT,
    },
    // {
    //   id: 6,
    //   title: t.menus?.points || 'Points',
    //   icon: ICONS.POINTS,
    //   selectIcon: ICONS.POINTS_SELECT,
    // },
  ];

  const handleSelect = (id: number) => {
    store?.dispatch(setSelectedMenuId(id));
    console.log('Selected menu ID:', id);
  };

  return (
    <div className="flex flex-col gap-[0.6vh]">
      {menus.map(menu => {
        // 使用 chrome.runtime.getURL() 获取扩展资源的完整 URL
        const iconUrl = chrome.runtime.getURL(`content-ui/${menu.icon}`);
        const selectIconUrl = chrome.runtime.getURL(`content-ui/${menu.selectIcon}`);

        return (
          <button
            key={menu.id}
            className={`cursor-pointer rounded-[4px] py-[1vh] hover:bg-gray-100`}
            onClick={() => handleSelect(menu.id)}
            type="button">
            <div className="flex w-full items-center justify-center rounded-full">
              <img
                src={selectedId === menu.id ? selectIconUrl : iconUrl}
                alt={menu.title}
                className="h-[3vh] w-[3vh] object-contain"
              />
            </div>
            <div
              className={`mt-[0.5vh] text-center text-[12px] font-bold ${selectedId === menu.id ? 'text-black' : 'text-gray-500'}`}>
              {menu.title}
            </div>
          </button>
        );
      })}
    </div>
  );
};
