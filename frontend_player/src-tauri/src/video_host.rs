//! 在主窗口内创建一个子窗口作为 mpv 的视频输出宿主（通过 --wid 传入 mpv）。
//! 子窗口被压在 z-order 底部，透明的 WebView 覆盖其上，前端 UI 即可悬浮在视频之上。

use windows::core::PCWSTR;
use windows::Win32::Foundation::{HWND, HINSTANCE, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{GetStockObject, BLACK_BRUSH, HBRUSH};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, GetClientRect, MoveWindow, RegisterClassExW,
    SetWindowPos, CS_HREDRAW, CS_VREDRAW, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    WNDCLASSEXW, WS_CHILD, WS_CLIPCHILDREN, WS_VISIBLE, WINDOW_EX_STYLE, WINDOW_STYLE,
};

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

const CLASS_NAME: &str = "IPlayerVideoHost";

/// 宿主窗口的消息过程：全部交给系统默认处理
unsafe extern "system" fn host_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    DefWindowProcW(hwnd, msg, wparam, lparam)
}

/// 创建视频宿主子窗口，返回其 HWND 原始值（isize）。
/// 必须在主线程调用（Tauri setup 钩子内）。
pub unsafe fn create_host(parent_raw: isize, w: i32, h: i32) -> Result<isize, String> {
    let parent = HWND(parent_raw as *mut core::ffi::c_void);
    let hmodule = GetModuleHandleW(None).map_err(|e| e.to_string())?;
    let instance = HINSTANCE(hmodule.0);
    let class_name = to_wide(CLASS_NAME);

    let mut wc = WNDCLASSEXW::default();
    wc.cbSize = std::mem::size_of::<WNDCLASSEXW>() as u32;
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = Some(host_proc);
    wc.hInstance = instance;
    wc.hbrBackground = HBRUSH(GetStockObject(BLACK_BRUSH).0);
    wc.lpszClassName = PCWSTR(class_name.as_ptr());
    // 已注册时返回 0，忽略即可
    let _ = RegisterClassExW(&wc);

    let hwnd = CreateWindowExW(
        WINDOW_EX_STYLE::default(),
        PCWSTR(class_name.as_ptr()),
        PCWSTR::null(),
        WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN,
        0,
        0,
        w,
        h,
        Some(parent),
        None,
        Some(instance),
        None,
    )
    .map_err(|e| e.to_string())?;

    // 压到 z-order 最底部，让 WebView2 窗口覆盖在它上面
    let _ = SetWindowPos(
        hwnd,
        Some(HWND_BOTTOM),
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
    );

    Ok(hwnd.0 as isize)
}

pub unsafe fn resize_host(host_raw: isize, x: i32, y: i32, w: i32, h: i32) -> Result<(), String> {
    let hwnd = HWND(host_raw as *mut core::ffi::c_void);
    MoveWindow(hwnd, x, y, w, h, true).map_err(|e| e.to_string())
}

pub unsafe fn destroy_host(host_raw: isize) {
    if host_raw != 0 {
        let hwnd = HWND(host_raw as *mut core::ffi::c_void);
        let _ = DestroyWindow(hwnd);
    }
}

/// 主窗口客户区尺寸（物理像素）
pub unsafe fn client_size(parent_raw: isize) -> (i32, i32) {
    let parent = HWND(parent_raw as *mut core::ffi::c_void);
    let mut rc = RECT::default();
    if GetClientRect(parent, &mut rc).is_ok() {
        (rc.right - rc.left, rc.bottom - rc.top)
    } else {
        (0, 0)
    }
}
