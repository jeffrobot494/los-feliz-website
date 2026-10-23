<?php
// wp-config for the Railway preview. Everything secret comes from Railway variables;
// nothing here needs editing.
$lfar_env = function ($key, $default = '') {
    $v = getenv($key);
    return ($v === false || $v === '') ? $default : $v;
};

define('DB_NAME', $lfar_env('MYSQLDATABASE', 'railway'));
define('DB_USER', $lfar_env('MYSQLUSER', 'root'));
define('DB_PASSWORD', $lfar_env('MYSQLPASSWORD'));
define('DB_HOST', $lfar_env('MYSQLHOST', 'localhost') . ':' . $lfar_env('MYSQLPORT', '3306'));
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

// Keys and salts: from WP_SALT_SEED if set, otherwise derived from the (secret) DB password,
// so they stay the same across deploys and logins survive a redeploy.
$lfar_seed = $lfar_env('WP_SALT_SEED', $lfar_env('MYSQLPASSWORD', 'lfar-preview'));
foreach (['AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY',
          'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT'] as $lfar_k) {
    define($lfar_k, hash('sha256', $lfar_k . '|' . $lfar_seed));
}

$table_prefix = 'wp_';

// Railway terminates HTTPS at its proxy
if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
    $_SERVER['HTTPS'] = 'on';
}

if ($lfar_domain = $lfar_env('RAILWAY_PUBLIC_DOMAIN')) {
    define('WP_HOME', 'https://' . $lfar_domain);
    define('WP_SITEURL', 'https://' . $lfar_domain);
}

// Instagram token can also come from a Railway variable instead of the database
if ($lfar_ig = $lfar_env('LFAR_IG_TOKEN')) {
    define('LFAR_IG_TOKEN', $lfar_ig);
}

define('WP_ENVIRONMENT_TYPE', 'staging');
define('WP_DEBUG', false);
define('DISALLOW_FILE_EDIT', true);
define('AUTOMATIC_UPDATER_DISABLED', true);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
require_once ABSPATH . 'wp-settings.php';
