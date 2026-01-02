// ==UserScript==
// @name         页面标题上报脚本
// @namespace    sleepy
// @version      2025.3.9
// @description  获取页面标题并上报到指定 API (包括浏览器名称) / 请在安装脚本后手动编辑下面的配置
// @author       nuym
// @author       wyf9
// @authors      gongfuture feat. kimi_k2
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      sleepy.wyf9.top
// @homepage     https://github.com/sleepy-project/sleepy
// @source       https://github.com/sleepy-project/sleepy/raw/refs/heads/main/client/browser-script.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ===== 参数配置 =====
    const API_URL = 'https://sleepy.wyf9.top/api/device/set'; // 完整 API 地址（以 /api/device/set 结尾）
    const SECRET = '绝对猜不出来的密码';                // 你的 secret
    const ID = '114514';                               // 设备 id
    const SHOW_NAME = '';                              // 设备名称，若为空则使用浏览器名称
    const NO_TITLE = 'url';                            // 页面标题为空时返回的值：'url' 使用完整 URL, 'host' 使用域名, 其他值则直接使用该值
    const BLACKLIST = ['admin', '后台'];               // 黑名单关键词数组（标题或 URL 包含即停止上报，不区分大小写）
    // 请确保 @connect 指令中的域名与 API_URL 域名一致
    // ===== 参数配置结束 =====

    /* ---------- 工具函数 ---------- */
    // ===== 日志处理函数 =====
    const log = msg => console.log(msg.replace(SECRET, '[REPLACED]'));
    const error = msg => console.error(msg.replace(SECRET, '[REPLACED]'));

    // ===== 黑名单检查函数 =====
    function inBlackList(t, u) {
        return BLACKLIST.some(k => {
            const K = k.toLowerCase();
            return t.toLowerCase().includes(K) || u.toLowerCase().includes(K);
        });
    }

    // ===== 获取浏览器名称 =====
    function browserName() {
        const ua = navigator.userAgent;
        if (ua.includes('Edg')) return 'Edge';
        if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
        return 'Unknown Browser';
    }

    // ===== 获取备用标题 =====
    function fallbackTitle() {
        switch (NO_TITLE) {
            case 'url': return location.href;
            case 'host': return location.hostname;
            default: return NO_TITLE;
        }
    }

    /* ---------- 上报函数 ---------- */
    function buildPayload(using) {
        const title = document.title.trim() || fallbackTitle();
        if (inBlackList(title, location.href)) {
            log('黑名单拦截，不上报');
            return null;
        }
        return {
            secret: SECRET,
            id: ID,
            show_name: SHOW_NAME || browserName(),
            using: using,
            status: title
        };
    }

    // 页面隐藏/卸载时用 Beacon → fetch(keepalive)
    function sendBeaconLike(payload) {
        const body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
            const ok = navigator.sendBeacon(API_URL, new Blob([body], { type: 'application/json' }));
            log(`Beacon 上报 ${ok ? '成功' : '失败'}`);
            return;
        }
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true
        }).catch(e => error('fetch keepalive 上报失败: ' + e));
    }

    // 页面正常存活时用 GM_xmlhttpRequest
    function sendGM(payload) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: API_URL,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(payload),
            onload: r => log(`API Response: ${r.responseText}`),
            onerror: e => error('GM_xmlhttpRequest 上报失败: ' + e)
        });
    }

    /* ---------- 事件 ---------- */
    function report(using) {
        const p = buildPayload(using);
        if (!p) return;
        sendGM(p);
    }

    /* ---------- 绑定事件 ---------- */
    window.addEventListener('DOMContentLoaded', () => report(true));
    window.addEventListener('focus', () => report(true));
    window.addEventListener('blur', () => report(false));

    // 关键：页面“隐藏”时立即用 Beacon/keepalive 上报
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            const p = buildPayload(false);
            if (p) sendBeaconLike(p);
        }
    });
})();