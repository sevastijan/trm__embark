<nav id="mobile-navigation">
   <ul class="mobile-nav mr-auto">
        <li class="nav-item">
            <a href="<?php if(!is_front_page()) echo esc_url( home_url( '/' ) );?>#about">About</a>
        </li><!-- /.nav-item -->
        <li class="nav-item dropdown">
            <a href="<?php if(!is_front_page()) echo esc_url( home_url( '/' ) );?>#features" class="dropdown-toggle" data-toggle="dropdown">Sector solutions</a>
            <ul>
                <li>
                    <a href="#banking" class="dropdown-item">Banking</a>
                </li>
                <li>
                    <a href="#insurance" class="dropdown-item">Insurance</a>
                </li>
                <li>
                    <a href="#landing" class="dropdown-item">Lending</a>
                </li>
                <li>
                    <a href="#debt" class="dropdown-item">Debt</a>
                </li>
            </ul>
        </li><!-- /.dropdown -->
    </ul><!-- /.mobile-nav mr-auto -->
</nav><!-- /#mobile-navigation -->