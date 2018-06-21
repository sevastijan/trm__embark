<nav class="navbar">
    <h2 class="hide">Main navigation</h2>
    <div class="container">
        <div class="row align-items-center justify-content-between w-100 no-gutters">
            <div class="col col-auto">
                <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="navbar-brand">
                    <img src="<?php echo get_template_directory_uri(); ?>/images/logo__embark--white.svg" alt="<?php echo get_bloginfo('name'); ?>" class="navbar-brand__logo" />
                </a>
            </div><!-- /.col col-auto -->
           <div class="col col-auto">
                <ul id="top-menu" class="navbar-nav mr-auto">
                    <li class="nav-item">
                        <a href="<?php if(!is_front_page()) echo esc_url( home_url( '/' ) );?>#about" class="nav-link">About</a>
                    </li><!-- /.nav-item -->
                    <li class="nav-item dropdown">
                        <a href="<?php if(!is_front_page()) echo esc_url( home_url( '/' ) );?>#sectors" class="nav-link dropdown-toggle" data-toggle="dropdown">Sector solutions</a>
                        <div class="dropdown-menu">
                            <a href="#banking" class="dropdown-item">Banking</a>
                            <a href="#insurance" class="dropdown-item">Insurance</a>
                            <a href="#landing" class="dropdown-item">Lending</a>
                            <a href="#debt" class="dropdown-item">Debt</a>
                        </div>
                    </li><!-- /.nav-item dropdown -->
                </ul><!-- /.navbar-nav mr-auto -->
                <button id="mmenu-triger" class="hamburger hamburger--squeeze" type="button" aria-label="Menu">
                    <span class="hamburger-box">
                        <span class="hamburger-inner"></span>
                    </span>
                </button>
            </div><!-- /.col col-auto -->
            <div class="col col-auto d-none d-md-flex">
                <div class="row no-gutters align-items-center">
                    <div class="col col-auto">
                        <a href="#get-in-touch" class="embark-button embark-button--small embark-button__full-background embark-button__full-background--primary-color mt-0">Get in touch</a>
                    </div><!-- /.col col-auto -->

                    <?php if(get_field( 'show_switcher', 'options' )): ?>

                        <div class="col col-auto">
                            <ul class="navbar-nav">
                                <li class="nav-item dropdown">

                                    <?php $label =  get_field( 'dropdown_label', 'options' ); ?>

                                    <a href="#dropdown" class="nav-link dropdown-toggle" data-toggle="dropdown"><img src="<?= $label['url']; ?>" alt="<?= $label['alt']; ?>" /></a>

                                    <?php if ( have_rows( 'language', 'options' ) ) : ?>

                                        <div class="dropdown-menu dropdown-menu--laguage">

                                            <?php while ( have_rows( 'language', 'options' ) ) : the_row(); ?>
                                                <?php $flag = get_sub_field( 'flag' ); ?>

                                                <a href="<?php the_sub_field( 'url' ); ?>" class="dropdown-item"><img src="<?= $flag['url']; ?>" alt="<?= $flag['alt']; ?>" class="icon-flag d-inline-block" /> <?php the_sub_field( 'name' ); ?></a>

                                            <?php endwhile; ?>

                                        </div><!-- /.dropdown-menu -->

                                    <?php endif; ?>

                                </li><!-- /.nav-item dropdown -->
                            </ul><!-- /.navbar-nav -->
                        </div><!-- /.col col-auto -->

                    <?php endif; ?>

                </div><!-- /.row no-gutters align-items-center -->
            </div><!-- /.col col-auto d-none d-md-flex -->
        </div><!-- /.row align-items-center justify-content-between w-100 no-gutters -->
    </div><!-- /.container -->
</nav><!-- /.navbar -->