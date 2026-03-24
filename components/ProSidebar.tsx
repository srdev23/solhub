import { Sidebar, Menu, MenuItem, SubMenu } from 'react-pro-sidebar';
import { RiCoinFill } from "react-icons/ri";
import { IoIosAddCircle, IoIosAirplane, IoIosAlarm, IoIosAlbums, IoIosAlert, IoIosAnalytics, IoIosArrowBack, IoIosAt, IoIosBaseball, IoIosBoat, IoIosBookmark, IoIosBrush, IoIosCard, IoIosDownload, IoIosSettings } from "react-icons/io";
import { IoBarChart } from "react-icons/io5";
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAppContext } from './context';
import { RxCross2 } from "react-icons/rx";
import Link from 'next/link';
import { AiOutlineDiscord } from "react-icons/ai";
import { FaXTwitter } from "react-icons/fa6";
import { FaYoutube } from "react-icons/fa";
import { FaTelegram } from "react-icons/fa";
import { FaInstagram } from "react-icons/fa";
import { RiTelegramLine } from "react-icons/ri";
export default function ProSidebar() {
    const route = useRouter();
    // State to manage the open state of the SubMenu
    const [openTokenManager, setOpenTokenManager] = useState(false);
    const [openMeteora, setOpenMeteora] = useState(false);
    const { state, toggleSidebar, sidebarClose } = useAppContext();
    // Effect to set the open state based on the current path
    useEffect(() => {
        if (
            route.pathname.startsWith('/token-manager')
            // route.pathname.startsWith('/openbook-market') ||
            // route.pathname.startsWith('/add-liquidity') ||
            // route.pathname.startsWith('/token-mint') ||
            // route.pathname.startsWith('/revoke-freeze') ||
            // route.pathname.startsWith('/remove-liquidity') ||
            // route.pathname.startsWith('/revoke-mint') ||
            // route.pathname.startsWith('/revoke-immutable') ||
            // route.pathname.startsWith('/tax-token') ||
            // route.pathname.startsWith('/update-token')
        ) {
            setOpenTokenManager(true);
            setOpenMeteora(false);
        } else if(route.pathname.startsWith('/meteora')){
            setOpenTokenManager(false);
            setOpenMeteora(true);
        }else {
            setOpenTokenManager(false);
            setOpenMeteora(false);
        }
    }, [route]);

    return (
        <Sidebar breakPoint='lg' className=' custom-scrollbar h-[84vh] overflow-y-auto ' toggled={state.sidebarOpen} onBackdropClick={toggleSidebar}>
            <div className='flex justify-between flex-col h-full'>
                <div>
                    <div className='w-full h-[50px] flex items-center justify-between text-[20px] px-8  '>
                        Tokens
                        <button onClick={toggleSidebar} className='min-[992px]:hidden' aria-label="Toggle Sidebar">
                            <RxCross2 size={20} />
                        </button>
                    </div>
                    <Menu
                        rootStyles={{
                            fontSize: "16px",
                            color: "#000"
                        }}
                        menuItemStyles={{
                            button: {
                                // Active state
                                [`&.active`]: {
                                    backgroundColor: '#27272a',
                                    color: '#b6c8d9',
                                    fontSize: "20px"
                                },
                                // Hover state
                                '&:hover': {
                                    backgroundColor: '#27272a',
                                    color: '#b6c8d9',
                                },
                            },
                            subMenuContent: {
                                // Open submenu background color
                                background: 'radial-gradient(circle at 24.1% 68.8%, rgb(50, 50, 50) 0%, rgb(0, 0, 0) 99.4%)',
                                color: '#b6c8d9',
                            }
                        }}
                    >
                        <MenuItem
                            icon={<RiCoinFill />}
                            onClick={() => {
                                sidebarClose()
                                route.push('/');
                            }}
                            className={route.pathname === '/' ? 'active' : ''}
                        >
                            Token Creator
                        </MenuItem>
                        <MenuItem
                            icon={<IoBarChart className='text-[15px]' />}
                            onClick={() => {
                                sidebarClose()
                                route.push('/liquidity-pool');
                            }}
                            className={route.pathname.includes('/liquidity-pool') ? 'active' : ''}
                        >
                            Create Liquidity Pool
                        </MenuItem>

                        <SubMenu
                            label="Token Manager"
                            icon={<IoIosSettings fontSize={20} />}
                            open={openTokenManager}
                            onClick={() => { 
                                setOpenTokenManager(!openTokenManager);
                                setOpenMeteora(false);
                            }}
                        >
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/token-manager/openbook-market');
                                }}
                                className={route.pathname.includes('/token-manager/openbook-market') ? 'active' : ''}
                            >
                                Create OpenBook Market
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/token-manager/add-liquidity');
                                }}
                                className={route.pathname.includes('/token-manager/add-liquidity') ? 'active' : ''}
                            >
                                Solana Liquidity Adder
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/token-manager/remove-liquidity');
                                }}
                                className={route.pathname.includes('/token-manager/remove-liquidity') ? 'active' : ''}
                            >
                                Solana Liquidity Remover
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/token-manager/token-mint');
                                }}
                                className={route.pathname.includes('/token-manager/token-mint') ? 'active' : ''}
                            >
                                Token Mint
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/token-manager/revoke-freeze');
                                }}
                                className={route.pathname.includes('/revoke-freeze') ? 'active' : ''}
                            >
                                Revoke Freeze Authority
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/token-manager/revoke-mint');
                                }}
                                className={route.pathname.includes('/token-manager/revoke-mint') ? 'active' : ''}
                            >
                                Revoke Mint Authority
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/token-manager/revoke-immutable');
                                }}
                                className={route.pathname.includes('/token-manager/revoke-immutable') ? 'active' : ''}
                            >
                                Make Token Immutable
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/token-manager/tax-token');
                                }}
                                className={route.pathname.includes('/token-manager/tax-token') ? 'active' : ''}
                            >
                                Tax Token Creator
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/token-manager/update-token');
                                }}
                                className={route.pathname.includes('/token-manager/update-token') ? 'active' : ''}
                            >
                                Update Token Metadata
                            </MenuItem>
                        </SubMenu>
                        <SubMenu
                            label="Meteora"
                            icon={<IoIosAlbums fontSize={20} />}
                            open={openMeteora}
                            onClick={() => {
                                setOpenTokenManager(false);
                                setOpenMeteora(!openMeteora);
                            }}
                        >
                            <MenuItem
                                onClick={() => {
                                    // sidebarClose()
                                    route.push('/meteora/create-pool');
                                }}
                                className={route.pathname.includes('/meteora/create-pool') ? 'active' : ''}
                            >
                                Create Amm Pool
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/meteora/add-liquidity');
                                }}
                                className={route.pathname.includes('/meteora/add-liquidity') ? 'active' : ''}
                            >
                                Add Liquidity
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    sidebarClose()
                                    route.push('/meteora/remove-liquidity');
                                }}
                                className={route.pathname.includes('/meteora/remove-liquidity') ? 'active' : ''}
                            >
                                Remove Liquidity
                            </MenuItem>
                        </SubMenu>
                        <MenuItem
                            icon={<IoIosDownload className='text-[15px]' />}
                            onClick={() => {
                                sidebarClose()
                                route.push('/bumpbot');
                            }}
                            className={route.pathname.includes('/bumpbot') ? 'active' : ''}
                        >
                            BumpBot
                        </MenuItem>
                        <MenuItem
                            icon={<IoIosAt className='text-[15px]' />}
                            onClick={() => {
                                sidebarClose()
                                route.push('/bundler');
                            }}
                            className={route.pathname.includes('/bundler') ? 'active' : ''}
                        >
                            Bundler
                        </MenuItem>
                        <MenuItem
                            icon={<IoIosBoat className='text-[15px]' />}
                            onClick={() => {
                                sidebarClose()
                                route.push('/volumebot');
                            }}
                            className={route.pathname.includes('/volumebot') ? 'active' : ''}
                        >
                            Volume Bot
                        </MenuItem>
                    </Menu>
                </div>
                <div className='sticky bottom-0  z-[999]'>
                    <Menu
                        rootStyles={{
                            fontSize: "16px",
                            color: "#000"
                        }}
                        menuItemStyles={{
                            button: {
                                // Active state
                                [`&.active`]: {
                                    backgroundColor: '#27272a',
                                    color: '#b6c8d9',
                                    fontSize: "20px"
                                },
                                // Hover state
                                '&:hover': {
                                    backgroundColor: '#27272a',
                                    color: '#b6c8d9',
                                },
                            },
                            subMenuContent: {
                                // Open submenu background color
                                background: 'radial-gradient(circle at 24.1% 68.8%, rgb(50, 50, 50) 0%, rgb(0, 0, 0) 99.4%)',
                                color: '#b6c8d9',
                            }
                        }}
                    >
                        <MenuItem style={{ background: 'radial-gradient(circle at 24.1% 68.8%, rgb(50, 50, 50) 0%, rgb(0, 0, 0) 99.4%)' }}>
                            <div className="flex gap-2 justify-center" style={{ background: 'radial-gradient(circle at 24.1% 68.8%, rgb(50, 50, 50) 0%, rgb(0, 0, 0) 99.4%)' }}>
                                <Link href={'https://discord.gg/RWw5uM83bn'} className="text-black flex bg-white" style={{ borderRadius: '0.5rem', height: '2rem', width: '2rem', justifyContent: 'center', alignItems: 'center' }} >
                                    <AiOutlineDiscord size={20} />
                                </Link>
                                <Link href={'/'} className="text-black flex bg-white" style={{ borderRadius: '0.5rem', height: '2rem', width: '2rem', justifyContent: 'center', alignItems: 'center' }} >
                                    <FaXTwitter size={18} />
                                </Link>
                                <Link href={'/'} className="text-black flex bg-white" style={{ borderRadius: '0.5rem', height: '2rem', width: '2rem', justifyContent: 'center', alignItems: 'center' }} >
                                    <FaYoutube size={20} />
                                </Link>
                                <Link href={'https://t.me/solhubofficial'} className="text-black flex bg-white" style={{ borderRadius: '0.5rem', height: '2rem', width: '2rem', justifyContent: 'center', alignItems: 'center' }} >
                                    <RiTelegramLine size={20} />
                                </Link>
                                <Link href={'/'} className="text-black flex bg-white" style={{ borderRadius: '0.5rem', height: '2rem', width: '2rem', justifyContent: 'center', alignItems: 'center' }} >
                                    <FaInstagram size={20} />
                                </Link>
                            </div>
                        </MenuItem>
                    </Menu>
                </div>
            </div>
        </Sidebar>
    );
}
