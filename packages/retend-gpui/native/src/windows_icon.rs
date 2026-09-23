//! Window icons for the Windows taskbar and title bar.

use std::{cell::RefCell, fs, mem::size_of, path::Path, ptr};

use gpui::Window;
use image::{imageops, imageops::FilterType, RgbaImage};
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use windows::Win32::{
    Foundation::{HWND, LPARAM, WPARAM},
    Graphics::Gdi::{
        CreateBitmap, CreateDIBSection, DeleteObject, BITMAPINFO, BITMAPV5HEADER, BI_BITFIELDS,
        DIB_RGB_COLORS, HGDIOBJ,
    },
    UI::WindowsAndMessaging::{
        CreateIconIndirect, DestroyIcon, SendMessageW, HICON, ICONINFO, ICON_BIG, ICON_SMALL,
        WM_SETICON,
    },
};

thread_local! {
    static ICONS: RefCell<Option<WindowIcons>> = const { RefCell::new(None) };
}

struct WindowIcons {
    small: HICON,
    large: HICON,
}

impl Drop for WindowIcons {
    fn drop(&mut self) {
        // SAFETY: Both handles belong to this struct and outlive every window
        // on the UI thread. Windows releases the icon resources here.
        unsafe {
            let _ = DestroyIcon(self.small);
            let _ = DestroyIcon(self.large);
        }
    }
}

pub(super) fn load(path: &str) -> Result<(), String> {
    let icons = WindowIcons::from_path(Path::new(path))
        .map_err(|error| format!("could not load the Windows icon at {path}: {error}"))?;
    ICONS.with(|stored| *stored.borrow_mut() = Some(icons));
    Ok(())
}

pub(super) fn apply(window: &Window) {
    let handle = window
        .window_handle()
        .expect("GPUI window has a native handle");
    let RawWindowHandle::Win32(handle) = handle.as_raw() else {
        panic!("GPUI Windows window has a Win32 handle");
    };
    let hwnd = HWND(handle.hwnd.get() as *mut _);
    ICONS.with(|stored| {
        if let Some(icons) = stored.borrow().as_ref() {
            // SAFETY: GPUI created this HWND on the current UI thread. The icon
            // handles remain valid in ICONS until that thread exits.
            unsafe {
                SendMessageW(
                    hwnd,
                    WM_SETICON,
                    Some(WPARAM(ICON_SMALL as usize)),
                    Some(LPARAM(icons.small.0 as isize)),
                );
                SendMessageW(
                    hwnd,
                    WM_SETICON,
                    Some(WPARAM(ICON_BIG as usize)),
                    Some(LPARAM(icons.large.0 as isize)),
                );
            }
        }
    });
}

impl WindowIcons {
    fn from_path(path: &Path) -> Result<Self, String> {
        let data = fs::read(path).map_err(|error| error.to_string())?;
        let is_svg = path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("svg"));
        let raster = if is_svg {
            None
        } else {
            Some(image::load_from_memory(&data).map_err(|error| error.to_string())?)
        };
        let render = |size| {
            if is_svg {
                render_svg(&data, size)
            } else {
                let resized = raster
                    .as_ref()
                    .expect("raster image exists")
                    .resize(size, size, FilterType::Lanczos3)
                    .to_rgba8();
                let mut canvas = RgbaImage::new(size, size);
                imageops::overlay(
                    &mut canvas,
                    &resized,
                    ((size - resized.width()) / 2) as i64,
                    ((size - resized.height()) / 2) as i64,
                );
                Ok(canvas)
            }
        };
        let small = create_icon(&render(16)?)?;
        let large = match create_icon(&render(256)?) {
            Ok(large) => large,
            Err(error) => {
                // SAFETY: The large icon failed, so no window received small.
                unsafe {
                    let _ = DestroyIcon(small);
                }
                return Err(error);
            }
        };
        Ok(Self { small, large })
    }
}

fn render_svg(data: &[u8], size: u32) -> Result<RgbaImage, String> {
    let tree = resvg::usvg::Tree::from_data(data, &resvg::usvg::Options::default())
        .map_err(|error| error.to_string())?;
    let mut pixmap = resvg::tiny_skia::Pixmap::new(size, size)
        .ok_or_else(|| "could not allocate icon pixels".to_string())?;
    let scale = (size as f32 / tree.size().width()).min(size as f32 / tree.size().height());
    let transform = resvg::tiny_skia::Transform::from_row(
        scale,
        0.0,
        0.0,
        scale,
        (size as f32 - tree.size().width() * scale) / 2.0,
        (size as f32 - tree.size().height() * scale) / 2.0,
    );
    resvg::render(&tree, transform, &mut pixmap.as_mut());
    let mut pixels = pixmap.data().to_vec();
    // tiny-skia returns premultiplied RGBA; the Win32 color bitmap needs
    // straight alpha so translucent edges retain their original color.
    for pixel in pixels.chunks_exact_mut(4) {
        let alpha = pixel[3];
        if alpha != 0 {
            for channel in &mut pixel[..3] {
                *channel = ((*channel as u32 * 255) / alpha as u32).min(255) as u8;
            }
        }
    }
    RgbaImage::from_raw(size, size, pixels).ok_or_else(|| "invalid icon pixels".to_string())
}

fn create_icon(image: &RgbaImage) -> Result<HICON, String> {
    let (width, height) = image.dimensions();
    let info = BITMAPV5HEADER {
        bV5Size: size_of::<BITMAPV5HEADER>() as u32,
        bV5Width: width as i32,
        bV5Height: -(height as i32),
        bV5Planes: 1,
        bV5BitCount: 32,
        bV5Compression: BI_BITFIELDS,
        bV5RedMask: 0x00ff0000,
        bV5GreenMask: 0x0000ff00,
        bV5BlueMask: 0x000000ff,
        bV5AlphaMask: 0xff000000,
        ..Default::default()
    };
    let mut bits = ptr::null_mut();
    // SAFETY: The DIB owns width * height * 4 bytes. We write exactly that
    // many BGRA bytes and keep both bitmaps alive through CreateIconIndirect.
    unsafe {
        // BITMAPV5HEADER starts with the same fields as BITMAPINFOHEADER.
        let color = CreateDIBSection(
            None,
            (&info as *const BITMAPV5HEADER).cast::<BITMAPINFO>(),
            DIB_RGB_COLORS,
            &mut bits,
            None,
            0,
        )
        .map_err(|error| error.to_string())?;
        for (source, target) in image.pixels().zip(std::slice::from_raw_parts_mut(
            bits as *mut [u8; 4],
            (width * height) as usize,
        )) {
            *target = [source[2], source[1], source[0], source[3]];
        }
        let mask_bits = vec![0u8; (width as usize).div_ceil(16) * 2 * height as usize];
        let mask = CreateBitmap(
            width as i32,
            height as i32,
            1,
            1,
            Some(mask_bits.as_ptr().cast()),
        );
        if mask.0.is_null() {
            let _ = DeleteObject(HGDIOBJ(color.0));
            return Err("could not create icon mask".to_string());
        }
        let icon = CreateIconIndirect(&ICONINFO {
            fIcon: true.into(),
            hbmMask: mask,
            hbmColor: color,
            ..Default::default()
        });
        let _ = DeleteObject(HGDIOBJ(mask.0));
        let _ = DeleteObject(HGDIOBJ(color.0));
        icon.map_err(|error| error.to_string())
    }
}
