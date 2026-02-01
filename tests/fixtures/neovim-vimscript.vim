" Sample Neovim VimScript configuration for testing
" This file contains various map command formats

" Basic mappings
nnoremap <leader>w :w<CR>
nnoremap <leader>q :q<CR>
nnoremap <leader>ff :Telescope find_files<CR>

" With noremap variations
noremap <leader>a :all<CR>
nmap <leader>b :buffers<CR>
vmap <leader>c :copy<CR>
imap jj <Esc>

" Modifier keys
nnoremap <C-s> :w<CR>
nnoremap <M-h> <C-w>h
nnoremap <S-Tab> :bprev<CR>

" Function keys
nnoremap <F1> :help<CR>
nnoremap <F12> :source %<CR>

" Silent mappings
nnoremap <silent> <leader>n :NvimTreeToggle<CR>

" Expression mappings (less common)
nnoremap <expr> j v:count ? 'j' : 'gj'

" Insert mode mappings
inoremap <C-h> <Left>
inoremap <C-l> <Right>

" Visual mode mappings
vnoremap < <gv
vnoremap > >gv

" Terminal mode mappings
tnoremap <Esc> <C-\><C-n>

" Map with comment description
nnoremap <leader>t :terminal<CR> " Open terminal
